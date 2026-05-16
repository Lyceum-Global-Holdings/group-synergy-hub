/**
 * Column definitions for the Excel-style inventory import grid.
 * Standards alignment:
 *  - GS1 GTIN check-digit validation on barcode (GTIN-8/12/13/14)
 *  - ISO 80000 / UN-CEFACT abbreviation enforced via item_units lookup
 *  - IFRS opening-balance via stock_transactions (server-side)
 */

export type ExcelColType = 'text' | 'number' | 'bool' | 'select';

export interface ExcelCol {
  key: string;
  label: string;
  type: ExcelColType;
  group: 'catalog' | 'stock';
  required?: boolean;
  width?: number;
  /** Source for select cells; resolved at runtime */
  source?: 'category' | 'unit' | 'location' | 'bin' | 'company' | 'supplier' | 'status';
  help?: string;
}

export const COLUMNS: ExcelCol[] = [
  { key: 'item_code', label: 'Item Code', type: 'text', group: 'catalog', width: 140, help: 'Blank = auto-generate' },
  { key: 'name', label: 'Name *', type: 'text', group: 'catalog', required: true, width: 220 },
  { key: 'description', label: 'Description', type: 'text', group: 'catalog', width: 220 },
  { key: 'category', label: 'Category *', type: 'select', source: 'category', group: 'catalog', required: true, width: 160 },
  { key: 'unit', label: 'Unit *', type: 'select', source: 'unit', group: 'catalog', required: true, width: 100, help: 'ISO/UN-CEFACT abbrev' },
  { key: 'barcode', label: 'Barcode (GTIN)', type: 'text', group: 'catalog', width: 140 },
  { key: 'sku', label: 'SKU', type: 'text', group: 'catalog', width: 120 },
  { key: 'brand', label: 'Brand', type: 'text', group: 'catalog', width: 120 },
  { key: 'manufacturer', label: 'Manufacturer', type: 'text', group: 'catalog', width: 140 },
  { key: 'is_serialized', label: 'Serialized', type: 'bool', group: 'catalog', width: 90 },
  { key: 'is_batch_tracked', label: 'Batch', type: 'bool', group: 'catalog', width: 80 },
  { key: 'unit_cost', label: 'Unit Cost', type: 'number', group: 'catalog', width: 110 },
  { key: 'selling_price', label: 'Selling Price', type: 'number', group: 'catalog', width: 120 },
  { key: 'reorder_level', label: 'Reorder', type: 'number', group: 'catalog', width: 90 },
  { key: 'min_stock_level', label: 'Min', type: 'number', group: 'catalog', width: 80 },
  { key: 'max_stock_level', label: 'Max', type: 'number', group: 'catalog', width: 80 },
  { key: 'status', label: 'Status', type: 'select', source: 'status', group: 'catalog', width: 110 },
  // Stock group
  { key: 'company', label: 'Company *', type: 'select', source: 'company', group: 'stock', required: true, width: 160 },
  { key: 'location', label: 'Location', type: 'select', source: 'location', group: 'stock', width: 160 },
  { key: 'bin', label: 'Bin', type: 'select', source: 'bin', group: 'stock', width: 120 },
  { key: 'opening_qty', label: 'Opening Qty', type: 'number', group: 'stock', width: 110 },
  { key: 'stock_notes', label: 'Stock Notes', type: 'text', group: 'stock', width: 180 },
];

export const STATUS_OPTIONS = ['active', 'inactive', 'discontinued'];

export type Row = Record<string, string>;

export const emptyRow = (): Row => COLUMNS.reduce((acc, c) => ({ ...acc, [c.key]: '' }), {});

/** GS1 GTIN-8/12/13/14 check digit validator (mod-10). */
export function isValidGTIN(code: string): boolean {
  if (!/^\d{8}$|^\d{12,14}$/.test(code)) return false;
  const digits = code.split('').map(Number);
  const check = digits.pop()!;
  let sum = 0;
  // Right-to-left, multiplier alternates 3,1
  digits.reverse().forEach((d, i) => {
    sum += d * (i % 2 === 0 ? 3 : 1);
  });
  const calc = (10 - (sum % 10)) % 10;
  return calc === check;
}

export function parseBool(v: string): boolean {
  return ['true', 'yes', 'y', '1', 'x'].includes(v.toLowerCase().trim());
}
