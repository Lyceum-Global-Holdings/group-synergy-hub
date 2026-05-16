## Goal
Make Inventory show stock correctly by selected Location and Sub-location permanently, without relying on the warehouse-level bin row as the physical stock location.

## Root cause
The current model now scopes `warehouse_bins` to the root warehouse, which is correct for shared bin codes. But several inventory reads and stock write paths still assume `warehouse_bins.location_id` is the physical stock location. That makes sub-location stock disappear or roll up incorrectly because the bin row points to the warehouse root, not the sub-location where stock actually sits.

## Permanent solution

1. **Canonicalize stock location at allocation level**
   - Treat `warehouse_bin_allocations.location_id` as the source of truth for physical stock location.
   - Keep `warehouse_bins.root_location_id/location_id` as the shared warehouse/bin master scope only.
   - Ensure all new/updated allocation rows are written with the exact selected location/sub-location.

2. **Replace Inventory’s split query logic with one canonical server RPC**
   - Update/create `list_warehouse_inventory` so it returns:
     - one item row per item,
     - location-filtered `current_stock` derived from allocation sums,
     - `bins` derived from allocations at the selected location/subtree,
     - parent location totals including child sub-locations,
     - sub-location totals showing only that sub-location subtree.
   - Use `warehouse_bin_allocations.location_id` for stock filtering, with fallback to bin location only for legacy rows.

3. **Update frontend Inventory to use the canonical RPC**
   - Refactor `useWarehouseItemsLazyInventory` to stop doing client-side bin/allocation enrichment.
   - Pass selected company, selected location, search/filter params, and pagination to the RPC.
   - Display `item.current_stock` as the selected location/sub-location stock total, not global item stock, when a location filter is active.
   - Remove the separate `all-items-location-stock` client-side query from `ItemMasterTab`, because it is duplicating logic and causing inconsistent totals.

4. **Fix all stock write paths that create/update allocations**
   - Update these paths to include allocation `location_id` and lookup existing allocations by `(item, bin, company, location)`:
     - Create item opening stock
     - Add from catalog
     - Bulk item import
     - Bulk stock upload
     - GRN bin allocation approval
     - Manual bin allocation dialog
     - Stock transfer destination allocation
     - Returns/adjustments where applicable
   - This prevents a sub-location receipt from merging into the same bin at the root warehouse.

5. **Add database guardrails**
   - Keep/complete the allocation trigger that validates allocation location belongs under the bin’s root warehouse.
   - Add/verify a uniqueness rule on `(warehouse_item_id, bin_id, company_id, location_id)` for active allocation rows.
   - Update stock transaction guard logic so ledger rows preserve the caller’s exact `location_id` when it is valid, rather than overwriting it with the bin root.

6. **Backfill existing data safely**
   - For existing allocation rows, populate `warehouse_bin_allocations.location_id` from the best available source:
     - exact stock transaction location for the item/bin,
     - then item location,
     - then bin root as last resort.
   - Recompute item master totals from allocations after the location backfill.

7. **Verification**
   - Query the DB to confirm positive allocations exist by sub-location.
   - Verify the Inventory RPC returns those rows for:
     - exact sub-location,
     - parent warehouse including child stock,
     - all locations.
   - Verify the preview no longer throws the current `Maximum call stack size exceeded` runtime error.
   - Confirm Inventory shows correct stock/bins after selecting a location and a sub-location.

## Technical notes
- Database structural changes will use migrations only.
- Data backfill/corrections will be handled separately as data operations, not schema migrations.
- The design follows SAP EWM/Oracle WMS style separation:
  - Bin master = warehouse/root scoped storage identity.
  - Allocation = exact physical stock location and quantity.
  - Ledger = immutable movement history at exact location/bin granularity.