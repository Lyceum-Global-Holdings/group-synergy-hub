## Plan: Fix Bulk add from Catalog location/bin posting

### Problem to fix
Bulk add from Catalog currently sends `location_id` and `bin_id`, but the backend only creates/updates the inventory item and inserts a stock transaction. It does not explicitly create/increment the matching `warehouse_bin_allocations` row for the selected exact physical node, so stock can appear under the item/default location or fail to show in the selected bin.

### Changes
1. **Backend RPC: `bulk_provision_inventory_from_catalog`**
   - Update the RPC to treat the selected bin as the source of truth for physical placement.
   - Validate that:
     - company is accessible,
     - location exists,
     - bin exists,
     - if a bin is selected, its exact `warehouse_bins.location_id` matches the selected location/sub-location.
   - Provision/find the per-company inventory row via `upsert_warehouse_inventory`.
   - For opening stock rows, explicitly upsert `warehouse_bin_allocations` on:
     - `warehouse_item_id`,
     - `bin_id`,
     - `company_id`,
     - `location_id`.
   - Increment `allocated_quantity` when the same item/bin/location already exists instead of creating duplicates.
   - Then insert the stock transaction for audit/ledger with the same `location_id` and `bin_id`.

2. **Frontend row picker: exact location/sub-location and bin safety**
   - Use the existing hierarchy label helper so the Location dropdown clearly shows parent → sub-location paths.
   - Keep the Bin dropdown filtered to bins attached to the selected exact location/sub-location only.
   - Add client-side validation that rejects any stale row where `bin_id` no longer belongs to the selected `location_id` before calling the RPC.

3. **Cache refresh after import**
   - After successful import, invalidate inventory and bin allocation queries so the selected location/sub-location and bin reflect the new stock immediately.

### Expected result
When a row is imported with `Location/Sub-location = X` and `Bin = Y`, stock is added to `warehouse_bin_allocations` for exactly `(item, company, X, Y)`, inventory filtering by that location/sub-location shows the item, and the selected bin shows the added quantity.