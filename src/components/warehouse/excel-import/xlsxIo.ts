import * as XLSX from 'xlsx';
import { COLUMNS, Row, emptyRow } from './excelColumns';

export function downloadTemplate() {
  const headers = COLUMNS.map((c) => c.label.replace(' *', ''));
  const sample = COLUMNS.map((c) => {
    switch (c.key) {
      case 'name': return 'Sample Item';
      case 'category': return 'Electronics';
      case 'unit': return 'PCS';
      case 'unit_cost': return 50;
      case 'selling_price': return 75;
      case 'status': return 'active';
      case 'company': return 'YOUR_COMPANY';
      case 'opening_qty': return 10;
      case 'location': return 'Main Warehouse';
      default: return '';
    }
  });
  const ws = XLSX.utils.aoa_to_sheet([headers, sample]);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Inventory');
  XLSX.writeFile(wb, 'inventory_import_template.xlsx');
}

export async function readXlsxFile(file: File): Promise<Row[]> {
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: 'array' });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const aoa: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '', raw: false });
  if (!aoa.length) return [];
  return aoaToRows(aoa);
}

/** Convert TSV (paste from Excel) into rows. */
export function parseTSV(text: string): Row[] {
  const lines = text.replace(/\r/g, '').split('\n').filter((l) => l.length > 0);
  const aoa = lines.map((l) => l.split('\t'));
  return aoaToRows(aoa);
}

function aoaToRows(aoa: any[][]): Row[] {
  const [headerRow, ...dataRows] = aoa;
  const headers = headerRow.map((h: any) => String(h).toLowerCase().trim());
  const colByHeader: Record<string, string> = {};
  COLUMNS.forEach((c) => {
    const labels = [c.label.replace(' *', '').toLowerCase(), c.key.toLowerCase()];
    headers.forEach((h, i) => {
      if (labels.includes(h)) colByHeader[i.toString()] = c.key;
    });
  });
  return dataRows.map((r) => {
    const row = emptyRow();
    r.forEach((v, i) => {
      const key = colByHeader[i.toString()];
      if (key) row[key] = v == null ? '' : String(v);
    });
    return row;
  });
}
