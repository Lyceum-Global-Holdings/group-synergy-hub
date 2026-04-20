import { supabase } from '@/integrations/supabase/client';

/**
 * Allocate sequential warehouse item codes following the project standard:
 *   INV-{CATEGORY_CODE}-{NNN}
 *
 * Standards:
 * - GS1 SKU Identification (deterministic unique identifier)
 * - ISO 8000-110 Master Data Quality (documented, repeatable pattern)
 * - ISO 7372 / SAP MM 3-letter category mnemonic
 *
 * Scopes:
 * - 'catalog'   → global uniqueness (queries warehouse_item_catalog)
 * - 'inventory' → per-company uniqueness (queries warehouse_items, scoped by company_id)
 *
 * Performs a single DB query per category per batch to discover the current
 * max sequence, then returns `count` sequential codes starting from max + 1.
 */
export type ItemCodeScope = 'catalog' | 'inventory';

export interface AllocateItemCodesOptions {
  categoryCode: string;
  count: number;
  scope: ItemCodeScope;
  companyId?: string | null;
}

export async function allocateItemCodes(
  optionsOrCategoryCode: AllocateItemCodesOptions | string,
  legacyCompanyId?: string | null,
  legacyCount?: number
): Promise<string[]> {
  // Backward-compat: support old positional signature (categoryCode, companyId, count)
  // which targeted the inventory table.
  const opts: AllocateItemCodesOptions =
    typeof optionsOrCategoryCode === 'string'
      ? {
          categoryCode: optionsOrCategoryCode,
          companyId: legacyCompanyId ?? null,
          count: legacyCount ?? 0,
          scope: 'inventory',
        }
      : optionsOrCategoryCode;

  const { categoryCode, count, scope, companyId = null } = opts;

  if (!categoryCode) {
    throw new Error('Category code is required to auto-generate item codes');
  }
  if (count <= 0) return [];

  const prefix = `INV-${categoryCode}-`;
  const table = scope === 'catalog' ? 'warehouse_item_catalog' : 'warehouse_items';

  let query = supabase
    .from(table)
    .select('item_code')
    .ilike('item_code', `${prefix}%`);

  // Company scoping only applies to inventory (catalog is global)
  if (scope === 'inventory' && companyId) {
    query = query.eq('company_id', companyId);
  }

  const { data, error } = await query;

  if (error) {
    console.error('[allocateItemCodes] Failed to fetch existing codes:', error);
    throw new Error(`Failed to allocate item codes for ${categoryCode}: ${error.message}`);
  }

  let maxSeq = 0;
  if (data && data.length > 0) {
    for (const row of data as Array<{ item_code: string | null }>) {
      const seqStr = (row.item_code || '').replace(prefix, '');
      const seq = parseInt(seqStr, 10);
      if (!isNaN(seq) && seq > maxSeq) {
        maxSeq = seq;
      }
    }
  }

  const codes: string[] = [];
  for (let i = 1; i <= count; i++) {
    const nextSeq = (maxSeq + i).toString().padStart(3, '0');
    codes.push(`${prefix}${nextSeq}`);
  }

  return codes;
}
