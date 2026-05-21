## Goal
Remove the per-row "Detailed Stock Balances" table from the Daily Site Report. Keep the "Stock by Warehouse" summary (since it shows useful aggregates without noisy "Unknown Item" / "-" rows).

## Changes

1. **`src/components/construction/dialogs/ViewSiteReportDialog.tsx`**
   - Remove the "Detailed Stock Balances" Card block (lines ~926–957).
   - Remove the now-unused `sortedStockBalances` and `itemTotals` derivations (lines ~309–325).

2. **`src/utils/siteReportPdfExport.ts`**
   - Remove the "Detailed Stock Balances" table rendering (lines ~470+), keep the per-warehouse summary above it.

3. **`supabase/functions/scheduled-telegram-reports/index.ts`**
   - Remove the "Detailed Stock Balances" table block (lines ~1066+) in the PDF generator; keep the warehouse summary.
   - Redeploy the edge function.

## Out of scope
- No changes to data hooks/queries — `stockBalances` is still used to compute the warehouse summary.
- No changes to Stock Movement section.
