/**
 * Shared lookup resolvers for the bulk-import pipeline.
 *
 * Each helper takes a CSV cell value and a list of records, and returns the
 * matching id (or null). Comparisons are case-insensitive and trim-safe.
 *
 * These helpers are deliberately framework-agnostic so they can be unit-tested
 * without mounting React.
 */

interface Named {
  id: string;
  name: string;
}

interface NamedWithCode extends Named {
  location_code?: string | null;
  type?: string;
}

interface UnitLike {
  id: string;
  abbreviation: string;
}

interface BinLike {
  id: string;
  bin_code: string;
  name: string;
}

const eq = (a: string | null | undefined, b: string | null | undefined): boolean =>
  !!a && !!b && a.toLowerCase().trim() === b.toLowerCase().trim();

export function resolveCategoryId(value: string, categories: Named[]): string | null {
  return categories.find((c) => eq(c.name, value))?.id ?? null;
}

export function resolveUnitId(value: string, units: UnitLike[]): string | null {
  return units.find((u) => eq(u.abbreviation, value))?.id ?? null;
}

export function resolveLocationId(value: string, locations: NamedWithCode[]): string | null {
  const warehouseLocations = locations.filter((l) => l.type === 'location' || l.type === undefined);
  return (
    warehouseLocations.find((l) => eq(l.name, value) || eq(l.location_code ?? '', value))?.id ?? null
  );
}

export function resolveSupplierId(value: string, suppliers: Named[]): string | null {
  return suppliers.find((s) => eq(s.name, value))?.id ?? null;
}

export function resolveCompanyId(value: string, companies: Named[]): string | null {
  return companies.find((c) => eq(c.name, value))?.id ?? null;
}

export function resolveBinId(value: string, bins: BinLike[]): string | null {
  return bins.find((b) => eq(b.bin_code, value) || eq(b.name, value))?.id ?? null;
}

/** Parse a CSV cell as a non-negative number; returns null on invalid. */
export function parseNumber(value: string): number | null {
  if (!value) return null;
  const num = parseFloat(value);
  return isNaN(num) ? null : num;
}

/** Parse 'true' / 'false' (case-insensitive). */
export function parseBoolean(value: string): boolean {
  return value.toLowerCase() === 'true';
}

/** Validate a status cell against the canonical allow-list. */
export function parseStatus(value: string): 'active' | 'inactive' | 'discontinued' | null {
  const v = value.toLowerCase();
  if (v === 'active' || v === 'inactive' || v === 'discontinued') return v;
  return null;
}
