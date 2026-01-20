import ExcelJS from 'exceljs';

/**
 * Read an Excel/CSV file and parse it to JSON
 */
export async function readExcelFile(file: File): Promise<Record<string, any>[]> {
  const workbook = new ExcelJS.Workbook();
  
  if (file.name.endsWith('.csv')) {
    // For CSV files, read as text and parse
    const text = await file.text();
    const lines = text.split('\n').filter(line => line.trim());
    if (lines.length === 0) return [];
    
    const headers = parseCSVLine(lines[0]);
    const jsonData: Record<string, any>[] = [];
    
    for (let i = 1; i < lines.length; i++) {
      const values = parseCSVLine(lines[i]);
      const rowData: Record<string, any> = {};
      headers.forEach((header, index) => {
        if (header) {
          rowData[header] = values[index] || null;
        }
      });
      if (Object.keys(rowData).length > 0) {
        jsonData.push(rowData);
      }
    }
    return jsonData;
  } else {
    // For Excel files
    const arrayBuffer = await file.arrayBuffer();
    await workbook.xlsx.load(arrayBuffer);
  }
  
  const worksheet = workbook.worksheets[0];
  if (!worksheet) return [];
  
  const jsonData: Record<string, any>[] = [];
  const headers: string[] = [];
  
  worksheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) {
      // First row is headers
      row.eachCell((cell, colNumber) => {
        headers[colNumber - 1] = String(cell.value || '').trim();
      });
    } else {
      // Data rows
      const rowData: Record<string, any> = {};
      row.eachCell((cell, colNumber) => {
        const header = headers[colNumber - 1];
        if (header) {
          rowData[header] = cell.value;
        }
      });
      // Only add if there's at least some data
      if (Object.keys(rowData).length > 0) {
        jsonData.push(rowData);
      }
    }
  });
  
  return jsonData;
}

/**
 * Parse a CSV line handling quoted values
 */
function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;
  
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current.trim());
  
  return result;
}

/**
 * Create and download an Excel file from array of arrays (AOA)
 */
export async function writeExcelFromAOA(
  data: any[][],
  fileName: string,
  sheetName: string = 'Sheet1'
): Promise<void> {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet(sheetName);
  
  data.forEach((row) => {
    worksheet.addRow(row);
  });
  
  // Style header row
  const headerRow = worksheet.getRow(1);
  headerRow.font = { bold: true };
  headerRow.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FFE0E0E0' }
  };
  
  // Auto-fit columns
  worksheet.columns.forEach((column) => {
    let maxLength = 10;
    column.eachCell?.({ includeEmpty: true }, (cell) => {
      const cellLength = String(cell.value || '').length;
      if (cellLength > maxLength) {
        maxLength = Math.min(cellLength, 50);
      }
    });
    column.width = maxLength + 2;
  });
  
  const buffer = await workbook.xlsx.writeBuffer();
  downloadBuffer(buffer, fileName);
}

/**
 * Create and download an Excel file from JSON data
 */
export async function writeExcelFromJSON(
  data: Record<string, any>[],
  fileName: string,
  sheetName: string = 'Sheet1'
): Promise<void> {
  if (data.length === 0) return;
  
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet(sheetName);
  
  // Add headers
  const headers = Object.keys(data[0]);
  worksheet.addRow(headers);
  
  // Style header row
  const headerRow = worksheet.getRow(1);
  headerRow.font = { bold: true };
  headerRow.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FFE0E0E0' }
  };
  
  // Add data rows
  data.forEach((item) => {
    worksheet.addRow(headers.map((h) => item[h]));
  });
  
  // Auto-fit columns
  worksheet.columns.forEach((column, index) => {
    let maxLength = headers[index]?.length || 10;
    column.eachCell?.({ includeEmpty: true }, (cell) => {
      const cellLength = String(cell.value || '').length;
      if (cellLength > maxLength) {
        maxLength = Math.min(cellLength, 50);
      }
    });
    column.width = maxLength + 2;
  });
  
  const buffer = await workbook.xlsx.writeBuffer();
  downloadBuffer(buffer, fileName);
}

/**
 * Create and download a CSV file from JSON data
 */
export async function writeCSVFromJSON(
  data: Record<string, any>[],
  fileName: string
): Promise<void> {
  if (data.length === 0) return;
  
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet('Sheet1');
  
  const headers = Object.keys(data[0]);
  worksheet.addRow(headers);
  
  data.forEach((item) => {
    worksheet.addRow(headers.map((h) => item[h]));
  });
  
  const buffer = await workbook.csv.writeBuffer();
  downloadBuffer(buffer, fileName, 'text/csv');
}

function downloadBuffer(
  buffer: ExcelJS.Buffer,
  fileName: string,
  mimeType: string = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
): void {
  const blob = new Blob([buffer], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
