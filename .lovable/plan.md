## Plan: make sub-location inventory visibility permanent

### What is actually going wrong
The current inventory RPC is returning stock for VEB/sub-locations, but it also returns zero/inactive item-master rows and several legacy tools still overwrite or infer location from the bin master (`warehouse_bins.location_id`) instead of the physical stock node (`warehouse_bin_allocations.location_id`). This is why the issue keeps coming back: reads were partially fixed, but legacy triggers/admin repair tools and some stock paths still collapse stock back to root/bin locations.

### Fix
1. **Lock the canonical WMS model in the database**
   - Keep bin codes scoped to the root warehouse so sub-locations can share those bins.
   - Make `warehouse_bin_allocations.location_id` the only physical stock-location source of truth.
   - Stop item-master `location_id` from being resynced from bin master location.
   - Replace the old allocation-to-item-location sync trigger with a safe no-op/compatibility function so future allocation changes cannot move item master rows away from sub-locations.

2. **Repair the inventory RPC permanently**
   - Rewrite `list_warehouse_inventory` so location-filtered inventory returns only rows that have stock in the selected location/subtree, unless the user explicitly chooses zero stock.
   - Aggregate bins from allocation rows at that exact physical location/subtree.
   - Add `location_id` and `location_name` into each returned bin JSON so the UI can show exactly where the bin quantity belongs.
   - Ensure parent locations include child stock, while child/sub-location views show only that subtree.

3. **Backfill and normalize existing data**
   - Backfill missing allocation `location_id` from stock transaction history first, then item location, then bin root.
   - Recompute `warehouse_items.current_stock`, `available_quantity`, and `reserved_quantity` from allocations so totals match the allocation ledger.
   - Preserve existing stock quantities; this is not a delete/reset.

4. **Remove unsafe admin repair behavior**
   - Update “Fix Allocations” and “Fix from History” flows so they never move allocation `bin_id` just because the item master has a location.
   - Any repair must update `warehouse_bin_allocations.location_id` instead of changing the shared bin code.

5. **Patch remaining high-risk stock write paths**
   - Ensure GRN approval allocation lookup/upsert uses `(item, bin, company, location)` and writes `location_id`.
   - Ensure stock transactions created from GRN include the same physical `location_id` and `bin_id`.
   - Keep previously patched import/upload/transfer paths aligned with the same rule.

6. **Frontend display correction**
   - Keep `/warehouse/inventory` using `list_warehouse_inventory` only.
   - Show bin badges from the RPC allocation result, not from bin master location.
   - Default filtered location views to in-stock/allocated rows only so zero inactive catalog rows do not hide the real sub-location stock.

7. **Verification**
   - Verify with database queries for known sub-locations like VEB: allocation counts, item counts, bin JSON, and parent rollup totals.
   - Verify network response for `/rpc/list_warehouse_inventory` shows positive rows and bins for the selected sub-location.
   - Check the runtime `Maximum call stack size exceeded` signal and remove any repeat render/update loop if it persists after the inventory correction.