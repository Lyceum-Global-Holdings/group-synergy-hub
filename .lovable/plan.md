## Problem

When a user tries to add an item to a sub-location (e.g. `LNNB → 9th Floor`, or `LNQ → LNQ-2F`), the item ends up attached to the parent location instead.

**Root cause:** The "Warehouse Location" dropdown in the Add/Edit Item flows hard-filters `locations` to only rows where `type === 'location'`. Sub-locations (`type='sublocation'`) and departments (`type='department'`) are excluded from the picker entirely, so the only selectable target is the parent location.

Verified in DB: 10 `location` rows, 30 `sublocation` rows, 29 `department` rows — none of the latter two appear in the picker today.

## Fix (UI only — no schema/business-logic changes)

Replace the "main locations only" filter with a hierarchical, indented option list that includes sub-locations and departments, so the chosen `location_id` is exactly what the user picked. International WMS standards (SAP EWM storage-types, GS1 sub-GLNs) treat sub-locations as first-class storage targets — this matches that model.

### Files to update

1. **`src/components/warehouse/SingleItemForm.tsx`** (line 83 + dropdown at lines 499–517)
   - Build `locationOptions` as a flat tree: parent (`location`) → child (`sublocation`) → grandchild (`department`), sorted by parent then name.
   - Render each option with a depth-based indent + a small badge (`Location` / `Sub-location` / `Department`) so the selection target is unambiguous.
   - Bin filter (`filteredBins`) already keys off `bin.location_id` — keep as-is so bins shown match the exact level chosen.

2. **`src/components/warehouse/BulkItemImportContent.tsx`** (line 160) and **`src/components/warehouse/BulkItemImportDialog.tsx`** (line 194)
   - Same change for the CSV "Default Location" picker so bulk imports can target sub-locations.

3. **`src/lib/bulkImport/lookups.ts`** (line 44)
   - Allow the location lookup used by CSV resolver to match `sublocation` and `department` rows by code/name (not just `type='location'`). Keeps backward compat for legacy CSVs that name a parent.

4. **`src/components/warehouse/CreateItemDialog.tsx`** (line 91)
   - Same hierarchical dropdown change as `SingleItemForm` for consistency.

### Out of scope (intentionally untouched)

- `WarehouseAssetReportDialog`, `AssetAnalytics`, `CapacityPlanningTab`, `StockAdjustmentDialog`, `LabourAllocationDialog`, construction DSR, `LocationManagementDialog`, `LocationHierarchyTab` — these legitimately operate at the parent-location level (reporting rollups, capacity planning, hierarchy admin) and do not match the user complaint.
- DB schema, RLS, and bin-allocation logic — sub-locations are already first-class in `warehouse_locations` and bins inherit through `list_bins_for_location_inherited`. No migration needed.

## Verification

After implementation:
1. Open Inventory → Add Item, expand the Warehouse Location dropdown — should show parents, indented sub-locations, and departments with type badges.
2. Pick `LNNB → 9th Floor`, save, then verify in DB that `warehouse_items.location_id` equals the 9th-Floor UUID (`cc8a3954-…`), not the LNNB UUID.
3. Confirm the Bin dropdown filters down to bins owned by 9th Floor (plus any inherited from LNNB via the existing `useBinsForLocation` RPC).
