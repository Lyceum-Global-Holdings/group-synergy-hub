## Goal
When using "Add by bin", staged rows should default Qty to issue = 0 (not bin qty). On "Add to MIN", any row with qty 0 is silently skipped (not flagged as an issue).

## Changes

**`src/components/warehouse/material-issue/AddByBinDialog.tsx`**
- In `handleConfirm`, set `quantity: 0` instead of `r.bin_qty` when mapping picked rows.

**`src/components/warehouse/material-issue/BulkAddItemsPanel.tsx`**
- In `summary` memo: treat `quantity <= 0` rows as neither `valid` nor `issues` — just skip/ignore them so they don't block commit or show as errors.
  - `valid`: `r.quantity > 0 && r.quantity <= r.current_stock && !already`
  - `issues`: only `r.quantity > r.current_stock || already` (drop the `<= 0` clause)
- Keep the Qty input UI as-is; zero just means "ignore this row on commit".

## Result
- Bins selected via "Add by bin" stage all linked items with qty 0.
- User fills in qty for the rows they want to issue; untouched (qty 0) rows are ignored on "Add to MIN".
- No false "issues" counter for zero-qty rows.