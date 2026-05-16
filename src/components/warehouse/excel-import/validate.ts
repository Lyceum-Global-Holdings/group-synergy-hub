import { COLUMNS, Row, STATUS_OPTIONS, isValidGTIN, parseBool } from './excelColumns';

export interface RowError {
  row: number;
  field: string;
  message: string;
}

export interface Lookups {
  categories: { id: string; name: string; code?: string | null }[];
  units: { id: string; abbreviation: string; name: string }[];
  locations: { id: string; name: string; location_code?: string | null }[];
  bins: { id: string; bin_code: string; name: string; location_id?: string | null }[];
  companies: { id: string; name: string }[];
}

function findByName<T extends { name: string }>(arr: T[], v: string) {
  const k = v.toLowerCase().trim();
  return arr.find((x) => x.name.toLowerCase() === k);
}

export function resolveRow(row: Row, lk: Lookups) {
  const category = row.category ? findByName(lk.categories, row.category) : undefined;
  const unit = row.unit
    ? lk.units.find(
        (u) =>
          u.abbreviation.toLowerCase() === row.unit.toLowerCase().trim() ||
          u.name.toLowerCase() === row.unit.toLowerCase().trim(),
      )
    : undefined;
  const company = row.company ? findByName(lk.companies, row.company) : undefined;
  const location = row.location
    ? lk.locations.find(
        (l) =>
          l.name.toLowerCase() === row.location.toLowerCase().trim() ||
          l.location_code?.toLowerCase() === row.location.toLowerCase().trim(),
      )
    : undefined;
  const bin = row.bin
    ? lk.bins.find(
        (b) =>
          b.bin_code.toLowerCase() === row.bin.toLowerCase().trim() ||
          b.name.toLowerCase() === row.bin.toLowerCase().trim(),
      )
    : undefined;
  return { category, unit, company, location, bin };
}

export function validateRow(row: Row, idx: number, lk: Lookups): RowError[] {
  const errors: RowError[] = [];
  const isEmpty = COLUMNS.every((c) => !row[c.key]?.trim());
  if (isEmpty) return errors;

  if (!row.name?.trim()) errors.push({ row: idx, field: 'name', message: 'Name is required' });

  const r = resolveRow(row, lk);
  if (row.category && !r.category) errors.push({ row: idx, field: 'category', message: `Unknown category "${row.category}"` });
  if (!row.category) errors.push({ row: idx, field: 'category', message: 'Category required' });
  if (row.unit && !r.unit) errors.push({ row: idx, field: 'unit', message: `Unknown unit "${row.unit}"` });
  if (!row.unit) errors.push({ row: idx, field: 'unit', message: 'Unit required' });
  if (row.company && !r.company) errors.push({ row: idx, field: 'company', message: `Unknown company "${row.company}"` });
  if (!row.company) errors.push({ row: idx, field: 'company', message: 'Company required' });
  if (row.location && !r.location) errors.push({ row: idx, field: 'location', message: `Unknown location "${row.location}"` });
  if (row.bin && !r.bin) errors.push({ row: idx, field: 'bin', message: `Unknown bin "${row.bin}"` });

  if (row.barcode && !isValidGTIN(row.barcode.trim())) {
    errors.push({ row: idx, field: 'barcode', message: 'Invalid GTIN check digit' });
  }

  ['unit_cost', 'selling_price', 'reorder_level', 'min_stock_level', 'max_stock_level', 'opening_qty'].forEach(
    (k) => {
      if (row[k] && isNaN(Number(row[k]))) errors.push({ row: idx, field: k, message: `${k} must be numeric` });
    },
  );

  if (row.status && !STATUS_OPTIONS.includes(row.status.toLowerCase().trim())) {
    errors.push({ row: idx, field: 'status', message: 'Status must be active/inactive/discontinued' });
  }

  const qty = Number(row.opening_qty || 0);
  if (qty > 0 && !row.location?.trim()) {
    errors.push({ row: idx, field: 'location', message: 'Location required when opening qty > 0' });
  }

  return errors;
}

export function toPayload(row: Row, lk: Lookups) {
  const r = resolveRow(row, lk);
  return {
    item_code: row.item_code?.trim() || null,
    name: row.name?.trim(),
    description: row.description?.trim() || null,
    category_id: r.category?.id || null,
    unit_id: r.unit?.id || null,
    brand: row.brand?.trim() || null,
    manufacturer: row.manufacturer?.trim() || null,
    barcode: row.barcode?.trim() || null,
    sku: row.sku?.trim() || null,
    unit_cost: row.unit_cost ? Number(row.unit_cost) : null,
    selling_price: row.selling_price ? Number(row.selling_price) : null,
    reorder_level: row.reorder_level ? Number(row.reorder_level) : null,
    min_stock_level: row.min_stock_level ? Number(row.min_stock_level) : null,
    max_stock_level: row.max_stock_level ? Number(row.max_stock_level) : null,
    is_serialized: row.is_serialized ? parseBool(row.is_serialized) : false,
    is_batch_tracked: row.is_batch_tracked ? parseBool(row.is_batch_tracked) : false,
    status: row.status?.toLowerCase().trim() || 'active',
    company_id: r.company?.id || null,
    location_id: r.location?.id || null,
    bin_id: r.bin?.id || null,
    opening_qty: row.opening_qty ? Number(row.opening_qty) : 0,
    stock_notes: row.stock_notes?.trim() || null,
  };
}
