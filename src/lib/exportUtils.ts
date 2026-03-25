import ExcelJS from "exceljs";

export async function exportToExcel(
  data: Record<string, unknown>[],
  fileName: string = "export",
  sheetName: string = "Sheet1"
) {
  if (!data.length) return;

  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet(sheetName);

  const columns = Object.keys(data[0]);
  worksheet.columns = columns.map((key) => ({
    header: key.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
    key,
    width: 20,
  }));

  // Style header row
  worksheet.getRow(1).font = { bold: true };
  worksheet.getRow(1).fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FFE2E8F0" },
  };

  data.forEach((row) => worksheet.addRow(row));

  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${fileName}.xlsx`;
  a.click();
  URL.revokeObjectURL(url);
}
