/**
 * RFC-4180-tolerant CSV parser used by the warehouse bulk-import pipeline.
 *
 * Single source of truth for parsing — both `BulkItemImportContent` (catalog)
 * and `BulkItemImportDialog` (inventory) MUST use this. Do not inline a copy.
 *
 * Behaviour:
 *  - Handles quoted fields, escaped quotes ("") and embedded newlines.
 *  - Trims each field.
 *  - Skips fully-empty rows.
 *  - Accepts both LF and CRLF line endings.
 */
export function parseCSV(text: string): string[][] {
  const lines: string[][] = [];
  let currentRow: string[] = [];
  let currentField = '';
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    const nextChar = text[i + 1];

    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        currentField += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      currentRow.push(currentField.trim());
      currentField = '';
    } else if ((char === '\n' || char === '\r') && !inQuotes) {
      if (char === '\r' && nextChar === '\n') i++;
      if (currentField || currentRow.length > 0) {
        currentRow.push(currentField.trim());
        if (currentRow.some((field) => field !== '')) lines.push(currentRow);
        currentRow = [];
        currentField = '';
      }
    } else {
      currentField += char;
    }
  }

  if (currentField || currentRow.length > 0) {
    currentRow.push(currentField.trim());
    if (currentRow.some((field) => field !== '')) lines.push(currentRow);
  }

  return lines;
}

/**
 * Convenience helper: triggers a browser download of a CSV string.
 * Used by the bulk importers' "Download Template" buttons.
 */
export function downloadCSV(filename: string, headers: string[], rows: string[][]): void {
  const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv' });
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  window.URL.revokeObjectURL(url);
}
