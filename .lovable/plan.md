# Fix: Reports export currency hardcoded as USD

## Problem
In downloaded XLSX reports (e.g. Stock on Hand), monetary columns display "USD 0.00" even when the report envelope currency is LKR. The header correctly shows "Currency: LKR (ISO 4217)" but cells still format as USD.

## Root cause
`src/lib/reports/format.ts` → `excelNumFmt(column)` falls back to the literal string `"USD"` when a column doesn't define its own `currency`. It never receives the envelope currency. Same issue would affect any non-USD envelope.

```ts
return `"${column.currency ?? "USD"}" #,##0.00;...`;
```

The XLSX renderer calls `excelNumFmt(col)` without passing envelope currency.

## Fix

1. **`src/lib/reports/format.ts`** — Update `excelNumFmt` signature to accept the envelope currency and use it as the fallback:
   ```ts
   export function excelNumFmt(column: ReportColumn, envelopeCurrency = "USD"): string | undefined
   ```
   Currency branch becomes `column.currency ?? envelopeCurrency`.

2. **`src/lib/reports/xlsxRenderer.ts`** — Pass `envelope.currency` at both call sites (data rows + totals row): `excelNumFmt(col, envelope.currency)`.

## Out of scope
No changes to PDF/CSV renderers (they already use `formatValue` which correctly falls back to `envelopeCurrency`). No registry/column definition changes. No data/business-logic changes.

## Verification
After fix, exporting Stock on Hand with LKR envelope shows "LKR 0.00" formatting in Unit Cost / Stock Value columns instead of "USD 0.00".
