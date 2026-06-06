## Root cause

The database column `warehouse_locations.type` has a CHECK constraint allowing only `warehouse`, `sublocation`, `department`. All 12 top-level rows are stored as `type = 'warehouse'`.

But the UI was built around the legacy value `'location'`:

- The Edit Location dialog (`src/pages/admin/WarehouseManagement.tsx`, line 839) exposes a **Type** dropdown with both **Warehouse** (`warehouse`) and **Location** (`location`). Picking "Location" sends `type='location'` to the DB → fails the CHECK constraint → save silently rolls back, so the type appears not to change.
- Many other screens filter `locations.filter(l => l.type === 'location')`. Since rows are actually `'warehouse'`, those pickers/grids come up empty — including the location list shown in Asset Management (`src/pages/warehouse/AssetManagement.tsx`, `getLocationsByType` at line 385), Asset Analytics, Capacity Planning, Location Hierarchy/Report tabs, bulk import dialogs, etc.

## Fix

Standardize the whole frontend on the DB's `warehouse` value (no schema/data changes).

### 1. `src/pages/admin/WarehouseManagement.tsx`
- Remove the invalid `<SelectItem value="location">` from the Edit Type dropdown (line 845). Keep `warehouse`, `sublocation`, `department`.
- Stats counter `totalLocations` (line 135) → count `l.type === 'warehouse'`.
- `getParentOptions()` (lines 335–339) → drop the `'location'` branch, keep `'warehouse'`.

### 2. `src/components/warehouse/LocationManagementDialog.tsx`
- `LocationType` union, default `formData.type`, reset value, and every `formData.type === 'location'` / `loc.type === 'location'` check → use `'warehouse'`.
- Same for the SelectItem value in the type dropdown and parent-of-sublocation filter.

### 3. Other consumers — replace `type === 'location'` with `type === 'warehouse'`
- `src/pages/warehouse/AssetManagement.tsx` — `getLocationsByType` (lines 385–387) and the param type.
- `src/components/warehouse/BulkAssetUpdateDialog.tsx` — `getLocationsByType` param type.
- `src/components/warehouse/AssetAnalytics.tsx` (line 59).
- `src/components/warehouse/CapacityPlanningTab.tsx` (line 13).
- `src/components/warehouse/LocationHierarchyTab.tsx` (line 31).
- `src/components/warehouse/LocationReportAnalytics.tsx` (lines 95, 188) and `src/utils/locationReportPdfExport.ts` (line 272) — update `ReportType` union and the warehouse filter.
- `src/components/warehouse/BulkAssetImportDialog.tsx` (line 193), `BulkItemImportDialog.tsx` (line 195), `BulkItemImportContent.tsx` (line 161), `PublicAssetTransferDialog.tsx` (line 133) — replace `'location'` in the allowed-types list with `'warehouse'`.
- `src/components/warehouse/LocationTemplateDialog.tsx` — every `type: 'location' as const` → `'warehouse'`, plus the `filter(l => l.type === 'location')` count.
- `src/components/warehouse/ImportLocationsDialog.tsx` (line 86) — narrow type cast to `'warehouse' | 'sublocation' | 'department'` and reject any imported `'location'` row (treat as `'warehouse'`).
- `src/types/warehouse.ts` (lines 6, 65) — drop `'location'` from the `type` unions.

### Not changed
- `transfer_type: 'location'` in stock-transfer dialogs/types — unrelated enum, leave alone.
- `ReportParameterPanel.tsx` `p.type === 'location'` — that's a report-parameter kind, not a warehouse type. Leave alone.
- DB schema and existing rows — no migration needed.

## Verification

1. Open Warehouse Management → edit an existing row, change Type between Warehouse / Sublocation / Department → Save Changes succeeds and the value persists after refresh.
2. Open Asset Management → the location dropdown lists the 12 warehouses (previously empty).
3. Asset Analytics, Capacity Planning, Location Hierarchy, Location Report — each now shows the warehouse rows.
4. Stats card "Warehouses/Locations" on `/admin/warehouse-management` shows 12 instead of 0.
