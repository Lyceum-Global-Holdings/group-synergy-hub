## Plan

Fix the Inventory tab so users can see stock again by replacing the current slow `list_warehouse_inventory` RPC with a simpler, indexed, pagination-first version.

### What I will change

1. **Rewrite `list_warehouse_inventory` again**
   - Keep the same RPC parameters and return shape used by the app.
   - Use `SECURITY DEFINER` so the function can read the required inventory/bin tables consistently while still enforcing company scoping through the `_company_id` argument.
   - Keep location filtering by expanding selected parent locations to their child sub-locations.

2. **Remove the timeout bottleneck**
   - Stop joining `warehouse_bins` inside the stock-total lateral query just to apply location scope.
   - Filter allocation rows by `warehouse_bin_allocations.location_id`, which is already indexed for `(company_id, location_id, warehouse_item_id)`.
   - Only build bin JSON for the current page of inventory rows.

3. **Preserve correct stock/bin display**
   - Current stock, available, and reserved quantities will come from live `warehouse_bin_allocations` totals.
   - Bin chips/details will be built from positive allocation rows only.
   - With no selected location, show company-wide stock.
   - With a selected location/sub-location, show stock only in that location scope.

4. **Validate after migration**
   - Re-run the Inventory tab RPC for the affected company (`NCG Warehouse Solutions`) with and without the selected location.
   - Confirm it returns rows quickly and includes non-zero stock/bin entries.

### Technical details

- The current request is still failing with `57014: canceling statement due to statement timeout` for `list_warehouse_inventory`.
- The database has stock data for the affected company: 548 positive bin allocation rows and total allocated stock of `40538.550`.
- The issue is still the RPC query shape, not missing stock records.