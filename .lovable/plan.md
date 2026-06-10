## Simplify BrowseInventoryDialog

**File:** `src/components/warehouse/BrowseInventoryDialog.tsx`

1. **Remove total inventory count and "loading more…" indicator** from the footer (lines 294–316). Keep only the "{n} selected · {x} units" summary plus the invalid-qty warning.

2. **Reduce table columns** to: Checkbox, Code, Name, Current Stock, Qty to Issue. Remove the UoM and Bin columns from both `<TableHeader>` and the row rendering. Update the empty-state `colSpan` from 7 → 5.

3. **Rename "Available" header → "Current Stock"** for clarity.

No changes to data fetching, auto-pagination, selection logic, or RPC params — only the visible columns and footer text are trimmed.
