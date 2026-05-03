## Problem
The Location dropdown in *Upload Stock via CSV* hides sub-locations because of:
```ts
const topLocations = (locations || []).filter(l => !l.parent_id);
```
Stock at child sites (e.g. LNQ-Aluminium, LNQ–Short Term Stock) cannot be received.

## Standard
SAP EWM / Oracle WMS / GS1 GLN: stock is posted to the lowest-level **Storage Location**. Parents are organisational nodes; the picker must expose every active location the user can access, with hierarchy visualised.

## Changes

### `src/components/warehouse/BulkStockUploadDialog.tsx`
1. Drop the `topLocations` filter; use the full permission-scoped `locations` list from `useWarehouseLocations()`.
2. Build a flat, depth-aware ordered list (parent → children, sorted by `location_code`/`name`) via a `buildLocationTree` helper.
3. Render each `SelectItem` with indentation based on depth and a code badge, e.g.:
   ```
   Lyceum Nugegoda Quarters     LNQ
     └ LNQ-Aluminium            LNQ-AL
     └ LNQ – Short Term Stock   LNQ-STS
   ```
4. If a `is_storage_location` flag exists on the location row, disable non-storage parents; otherwise leave all selectable.
5. Empty-bin message when chosen location has no active bins: "No bins configured at this location. Create a bin first or pick a different location."

### Not changing
- DB / RLS — locations are already company- and permission-scoped.
- Bin query — already filters by `location_id`; will work correctly once a sub-location is selectable.
- Other dialogs — out of scope unless reported.
