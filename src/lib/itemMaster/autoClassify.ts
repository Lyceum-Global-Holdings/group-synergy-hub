/**
 * Offline, deterministic auto-classifier for Item Master entries.
 *
 * Standards:
 * - UoM codes follow UN/CEFACT Recommendation 20 (EA, MTR, KGM, LTR, MMT, PR,
 *   SET, BX, RO, PK, GRM, H87…).
 * - Category families follow the UNSPSC top-level family naming convention
 *   (e.g. "Electrical & Lighting" ≈ UNSPSC family 39).
 *
 * Resolution against tenant data (item_categories / item_units) is done by
 * case-insensitive `name`/`abbreviation` match. Categories are NEVER auto-
 * created — if no tenant row matches, the row stays empty and a warning is
 * surfaced (respects the item-category-depth-cap memory).
 */

export type Confidence = 'high' | 'low' | 'none';

export interface ClassifyInput {
  name: string;
  categories: Array<{ id: string; name: string; code?: string | null }>;
  units: Array<{ id: string; name: string; abbreviation: string }>;
}

export interface ClassifyResult {
  unit_id: string | null;
  /** UN/CEFACT code that was detected before resolving against tenant units. */
  uom_code: string | null;
  category_id: string | null;
  /** Suggested UNSPSC-aligned family name (for the warning when no tenant
   *  category matches). */
  category_family: string | null;
  confidence: Confidence;
  warnings: string[];
}

// ---------- UN/CEFACT Rec 20 unit map ----------

interface UomRule {
  /** UN/CEFACT Rec 20 code. */
  code: string;
  /** Common abbreviations a tenant might use locally — used to resolve
   *  the rule against the tenant `item_units.abbreviation` column. */
  aliases: string[];
  /** Regex that, when matched in the item name, triggers this UoM. */
  match: RegExp;
}

const UOM_RULES: UomRule[] = [
  // Length
  { code: 'MMT', aliases: ['MM', 'MMT'], match: /\b\d+(?:\.\d+)?\s*mm\b/i },
  { code: 'MTR', aliases: ['M', 'MTR', 'MT'], match: /\b\d+(?:\.\d+)?\s*m(?:eter|etre)?s?\b/i },
  // Mass
  { code: 'GRM', aliases: ['G', 'GRM', 'GR'], match: /\b\d+(?:\.\d+)?\s*g(?:ram)?s?\b/i },
  { code: 'KGM', aliases: ['KG', 'KGM', 'KGS'], match: /\b\d+(?:\.\d+)?\s*kg\b/i },
  // Volume
  { code: 'MLT', aliases: ['ML', 'MLT'], match: /\b\d+(?:\.\d+)?\s*ml\b/i },
  { code: 'LTR', aliases: ['L', 'LTR', 'LT'], match: /\b\d+(?:\.\d+)?\s*l(?:tr|iter|itre)?s?\b/i },
  // Packaging tokens
  { code: 'PR', aliases: ['PR', 'PAIR'], match: /\bpairs?\b/i },
  { code: 'SET', aliases: ['SET'], match: /\bsets?\b/i },
  { code: 'BX', aliases: ['BX', 'BOX'], match: /\bbox(?:es)?\b/i },
  { code: 'RO', aliases: ['RO', 'ROLL'], match: /\brolls?\b/i },
  { code: 'PK', aliases: ['PK', 'PACK', 'PKT'], match: /\bpack(?:s|et|ets)?\b/i },
  // Each / piece — keep last so it loses to more specific tokens
  { code: 'EA', aliases: ['EA', 'PCS', 'PC', 'NOS', 'NO', 'EACH', 'H87'], match: /\b(?:pcs?|each|nos?|unit|units)\b/i },
];

function detectUom(name: string): { code: string | null; strong: boolean } {
  for (const rule of UOM_RULES) {
    if (rule.match.test(name)) {
      // "EA" via the catch-all word is a weak signal; others are strong.
      const strong = rule.code !== 'EA';
      return { code: rule.code, strong };
    }
  }
  return { code: null, strong: false };
}

function resolveUnitId(
  uomCode: string | null,
  units: ClassifyInput['units'],
): string | null {
  if (!uomCode) {
    // Fall back to the tenant's "each/pcs" unit if any.
    const fallback = units.find((u) =>
      ['EA', 'PCS', 'PC', 'NOS', 'NO', 'EACH'].includes(u.abbreviation.toUpperCase()),
    );
    return fallback?.id ?? null;
  }
  const rule = UOM_RULES.find((r) => r.code === uomCode);
  const aliases = rule ? rule.aliases : [uomCode];
  const aliasUpper = new Set(aliases.map((a) => a.toUpperCase()));
  const match = units.find((u) => aliasUpper.has(u.abbreviation.toUpperCase()));
  if (match) return match.id;
  // Fallback to each/pcs
  return resolveUnitId(null, units);
}

// ---------- UNSPSC-aligned category keyword dictionary ----------

interface CategoryRule {
  family: string;
  /** Common tenant category names that should match this family. */
  aliases: string[];
  /** Keyword tokens (lowercase, word-boundary matched). */
  keywords: string[];
}

const CATEGORY_RULES: CategoryRule[] = [
  {
    family: 'Electrical & Lighting',
    aliases: ['Electrical', 'Electrical & Lighting', 'Lighting', 'Electrical and Lighting'],
    keywords: [
      'led', 'lamp', 'bulb', 'ceiling', 'recessed', 'downlight', 'spotlight',
      'switch', 'socket', 'outlet', 'breaker', 'mcb', 'rcb', 'rcbo',
      'cable', 'wire', 'conduit', 'trunking', 'junction', 'ballast', 'driver',
      'fluorescent', 'fitting', 'fixture', 'panel', 'din', 'contactor', 'relay',
    ],
  },
  {
    family: 'Plumbing',
    aliases: ['Plumbing', 'Plumbing & Sanitary', 'Sanitary'],
    keywords: [
      'pipe', 'pvc', 'cpvc', 'hdpe', 'ppr', 'fitting', 'elbow', 'tee', 'coupling',
      'valve', 'gate', 'ball', 'check', 'tap', 'faucet', 'shower', 'basin',
      'toilet', 'wc', 'cistern', 'flush', 'sink', 'drain', 'trap',
    ],
  },
  {
    family: 'Construction materials',
    aliases: ['Construction', 'Construction materials', 'Civil', 'Building materials'],
    keywords: [
      'cement', 'sand', 'aggregate', 'concrete', 'mortar', 'plaster', 'brick',
      'block', 'rebar', 'steel', 'timber', 'plywood', 'mdf', 'gypsum', 'tile',
      'grout', 'sealant', 'waterproof',
    ],
  },
  {
    family: 'Paints & Coatings',
    aliases: ['Paints', 'Paints & Coatings', 'Coatings'],
    keywords: [
      'paint', 'primer', 'undercoat', 'topcoat', 'enamel', 'emulsion', 'thinner',
      'varnish', 'lacquer', 'epoxy', 'coating', 'brush', 'roller',
    ],
  },
  {
    family: 'Hardware & Fasteners',
    aliases: ['Hardware', 'Hardware & Fasteners', 'Fasteners'],
    keywords: [
      'screw', 'nail', 'bolt', 'nut', 'washer', 'anchor', 'hinge', 'lock',
      'padlock', 'handle', 'bracket', 'clamp', 'staple', 'rivet',
    ],
  },
  {
    family: 'Tools',
    aliases: ['Tools', 'Hand Tools', 'Power Tools'],
    keywords: [
      'drill', 'driver', 'hammer', 'wrench', 'spanner', 'plier', 'pliers',
      'screwdriver', 'saw', 'grinder', 'cutter', 'tape', 'level', 'chisel',
      'trowel', 'shovel',
    ],
  },
  {
    family: 'Safety & PPE',
    aliases: ['Safety', 'PPE', 'Safety & PPE'],
    keywords: [
      'helmet', 'gloves', 'glove', 'goggles', 'mask', 'respirator', 'vest',
      'harness', 'boots', 'earplug', 'earmuff', 'ppe', 'safety',
    ],
  },
  {
    family: 'IT & Office',
    aliases: ['IT', 'Office', 'IT & Office', 'Office Supplies'],
    keywords: [
      'laptop', 'desktop', 'monitor', 'keyboard', 'mouse', 'printer', 'toner',
      'cartridge', 'router', 'switch', 'hdmi', 'usb', 'cable', 'paper',
      'pen', 'stapler', 'folder',
    ],
  },
  {
    family: 'Consumables',
    aliases: ['Consumables', 'General Consumables'],
    keywords: ['tissue', 'wipe', 'cleaner', 'detergent', 'soap', 'sanitizer', 'bag'],
  },
];

function detectCategory(name: string): { family: string | null; score: number } {
  const lower = name.toLowerCase();
  let best: { family: string; score: number } | null = null;
  for (const rule of CATEGORY_RULES) {
    let score = 0;
    for (const kw of rule.keywords) {
      // word-boundary on either side for robust matching
      const re = new RegExp(`\\b${kw}\\b`, 'i');
      if (re.test(lower)) score += 1;
    }
    if (score > 0 && (!best || score > best.score)) {
      best = { family: rule.family, score };
    }
  }
  return best ? { family: best.family, score: best.score } : { family: null, score: 0 };
}

function resolveCategoryId(
  family: string | null,
  categories: ClassifyInput['categories'],
): string | null {
  if (!family) return null;
  const rule = CATEGORY_RULES.find((r) => r.family === family);
  const aliases = new Set(
    [family, ...(rule?.aliases ?? [])].map((a) => a.toLowerCase().trim()),
  );
  const match = categories.find((c) => aliases.has(c.name.toLowerCase().trim()));
  return match?.id ?? null;
}

export function classifyItem({ name, categories, units }: ClassifyInput): ClassifyResult {
  const trimmed = (name || '').trim();
  if (!trimmed) {
    return {
      unit_id: null,
      uom_code: null,
      category_id: null,
      category_family: null,
      confidence: 'none',
      warnings: [],
    };
  }

  const uom = detectUom(trimmed);
  const cat = detectCategory(trimmed);

  const unit_id = resolveUnitId(uom.code, units);
  const category_id = resolveCategoryId(cat.family, categories);

  const warnings: string[] = [];
  if (cat.family && !category_id) {
    warnings.push(
      `Suggested category "${cat.family}" — no matching tenant category found. Pick one manually.`,
    );
  }
  if (uom.code && !unit_id) {
    warnings.push(`Suggested UoM "${uom.code}" — not configured in this tenant.`);
  }

  let confidence: Confidence = 'none';
  if (uom.strong && cat.score >= 2) confidence = 'high';
  else if (uom.code || cat.score >= 1) confidence = 'low';

  return {
    unit_id,
    uom_code: uom.code,
    category_id,
    category_family: cat.family,
    confidence,
    warnings,
  };
}
