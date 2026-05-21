## Plan: restore stock movement and current stock in Daily Site Reports

### What I will fix
1. **Daily Site Report data hook**
   - Update `useDailyMaterialsActivity` so it reads item master fields from `warehouse_items_full` / catalog-flattened data instead of stale `warehouse_items.item_code/name` fields.
   - Remove the old filter that excludes normal `material_issue` and `material_return` stock ledger entries, so the report shows all real stock movements for the selected day/period.
   - Query `stock_transactions` by `company_id`, not only by embedded `warehouse_items.company_id`, to match the ledger and multi-tenant isolation standard.

2. **Current stock in hand**
   - Update the current stock balance query to use `warehouse_bin_allocations` as the stock source of truth and resolve item code/name from `warehouse_items_full`.
   - Aggregate by item + location/warehouse so the report shows location-scoped stock in hand, not stale global item master stock.

3. **Report preview and PDF output**
   - Ensure the View Site Report dialog and exported PDF receive the corrected `adjustments` and `stockBalances` arrays.
   - Rename/align labels from “Stock Adjustments” to “Stock Movements” where this section now includes all ledger movements.
   - Add `material_issue` and `material_return` labels/badge handling so they display correctly in the UI/PDF.

4. **Verify the fix**
   - Check the relevant source after changes and validate the report data path no longer contains the old exclusion filter or stale item master field reads.
   - If available, use the current preview/log signals to confirm the Daily Site Report can render movement and stock-in-hand sections instead of blank sections.