## Goal

Scope the **Bulk Change Stock Owner** action to the currently selected location (and its sub-locations / departments) only. Never allow a system-wide ownership change from this dialog.

## Behavior

- The dialog always operates within the location selected in the global header (`globalLocationId`).
- If the selected location is a parent (warehouse), the change covers the parent + all descendants (sub-locations and departments).
- If the selected location is a leaf (sub-location / department), only that node is affected.
- If **no** global location is selected, the "Transfer ownership" button is disabled and an inline warning explains: *"Select a location in the header to change Stock Owner. System-wide changes are not allowed here."*

## Changes

### `src/components/warehouse/BulkChangeStockOwnerDialog.tsx`
- Remove the `scope` Select and the `all_locations` path entirely.
- Load warehouse locations via `useWarehouseLocations`. Compute `effectiveLocationIds = [globalLocationId, ...descendants(globalLocationId)]` (BFS over `parent_id`).
- Always call `bulk_change_stock_owner` with `_location_ids: effectiveLocationIds`.
- Replace the scope row with a read-only summary chip: *"Scope: {breadcrumb of selected location} (+N sub-locations)"*.
- Disable submit + show warning banner when `!globalLocationId`.

### No database changes
The existing `bulk_change_stock_owner(_location_ids uuid[])` already filters `warehouse_bin_allocations.location_id = ANY(_location_ids)`. Passing the descendant set is sufficient.

### No other UI changes
Inventory tab, filters, types, and other dialogs are untouched.

## Out of scope
- No change to the Stock Owner *filter* (read-only) or Bulk Update dialog.
- No RPC / migration changes.
