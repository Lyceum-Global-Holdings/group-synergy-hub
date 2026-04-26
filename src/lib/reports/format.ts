import { ReportColumn } from "./types";

/** Format a value for screen / CSV / PDF output (XLSX uses numFmt instead). */
export function formatValue(
  value: unknown,
  column: ReportColumn,
  envelopeCurrency: string,
): string {
  if (value === null || value === undefined || value === "") return "";

  switch (column.type) {
    case "integer":
      return new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(Number(value));
    case "number":
      return new Intl.NumberFormat("en-US", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }).format(Number(value));
    case "currency": {
      const code = column.currency ?? envelopeCurrency;
      try {
        return new Intl.NumberFormat("en-US", {
          style: "currency",
          currency: code,
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        }).format(Number(value));
      } catch {
        return `${code} ${Number(value).toFixed(2)}`;
      }
    }
    case "percent":
      return `${(Number(value) * 100).toFixed(2)}%`;
    case "date":
      return new Date(String(value)).toISOString().slice(0, 10); // ISO 8601 date
    case "datetime":
      return new Date(String(value)).toISOString().replace("T", " ").slice(0, 19) + "Z";
    default:
      return String(value);
  }
}

/** Excel numFmt strings */
export function excelNumFmt(column: ReportColumn): string | undefined {
  switch (column.type) {
    case "integer":
      return "#,##0";
    case "number":
      return "#,##0.00";
    case "currency":
      // ISO 4217 code prefix to keep currency explicit
      return `"${column.currency ?? "USD"}" #,##0.00;[Red]-"${column.currency ?? "USD"}" #,##0.00`;
    case "percent":
      return "0.00%";
    case "date":
      return "yyyy-mm-dd";
    case "datetime":
      return "yyyy-mm-dd hh:mm:ss";
    default:
      return undefined;
  }
}
