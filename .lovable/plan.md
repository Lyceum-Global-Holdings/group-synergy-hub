## Problem

The Reports Center location dropdown lists **every warehouse location in the database**, regardless of which company is currently selected. This breaks data isolation: a user working under Company A can pick a location that is allocated only to Company B, producing empty/irrelevant report results and exposing the existence of out-of-scope locations.

The rest of the app (Dashboards, GRN, Stock Add, Construction Inventory, Assign Location dialog) already uses the canonical company-scoped resolver `get_effective_locations_for_company` — only the Reports Center was overlooked.

## Standard being followed

- **SAP EWM / S4HANA** — storage locations are always resolved relative to the active company code; pickers never enumerate cross-company plants.
- **ISO 8000 master-data integrity** — reference-data dropdowns must reflect the active organizational scope.
- **Project memory** (`mem://architecture/warehouse-location-and-bin-management`, `mem://access-control/hierarchical-location-permissions`) — locations are resolved through explicit assignments + `inherit_parent` chains via the `get_effective_locations_for_company` SECURITY DEFINER RPC, plus the user's `user_location_permissions` / `view_all_locations` flag.

## Solution

Replace the global `useWarehouseLocations()` call inside `ReportParameterPanel` with the canonical company-scoped + permission-aware resolver, and honor the global header location filter as a default.

### Resolution order for the dropdown options

1. Start from `useEffectiveLocationsForCompany(selectedCompany.id)` — only locations allocated (explicit or inherited) to the active company.
2. Intersect with the user's `user_location_permissions` unless their profile flag `view_all_locations = true` (matches the rest of the app).
3. Keep only nodes of type `location` (same filter the panel already applies), sorted by name.
4. If `selectedCompany` is null, show an empty list with a hint "Select a company first" rather than every location in the system.

### Behavior changes in the panel

- Default value of any `location` parameter becomes the header `globalLocationId` (from `LocationFilterContext`) when it is in the allowed set; otherwise "All locations".
- When the selected company changes, the panel re-runs the location query and clears any stale `locationId` value that is no longer in the allowed set (prevents silent zero-row reports).
- Loading state shown in the Select trigger ("Loading locations…") while the RPC is in flight.
- Disabled state with helper text when the resolved list is empty ("No locations allocated to this company").

### Server-side safety net

Reports already pass `p_company_id` to their RPCs, so a stray location id cannot leak data. We add a defensive guard in `useReportData.ts`: if `locationId` is set but not present in the company's effective list, drop it before calling the RPC and surface a non-blocking toast ("Location not available for this company — showing all locations").

### Files to change

- `src/components/management/reports/ReportParameterPanel.tsx`
  - Swap `useWarehouseLocations` → `useEffectiveLocationsForCompany(selectedCompany?.id)`.
  - Apply user-permission intersection using `useUserLocationPermissions(user.id)` + `useUserViewAllLocations(user.id)`.
  - Read `globalLocationId` from `useLocationFilter()` for default seeding.
  - Add loading / empty / disabled UX for the `location` Select.
  - Clear stale `locationId` when the allowed set changes.
- `src/hooks/reports/useReportData.ts`
  - Defensive scrub: if `locationId` ∉ effective set for `selectedCompany`, set to `null` before calling the RPC.
- `src/pages/management/ReportsCenter.tsx`
  - Pass the resolved effective-location list down (or expose via the same hook in the panel — no prop drilling needed).

### What is NOT changed

- No DB migrations. Existing RPCs (`get_effective_locations_for_company`, report RPCs) already enforce company scope.
- No changes to report registry signatures or column outputs.
- No change to the global header Location Selector.

## Acceptance criteria

- Switching the active company instantly refreshes the Reports Center location dropdown to only that company's allocated locations.
- Users without `view_all_locations` only see locations they are explicitly permitted on.
- Selecting "All locations" runs the report scoped to all of the company's effective locations (current behavior).
- A previously chosen location id that becomes invalid after a company switch is cleared automatically.
- No location belonging exclusively to another company appears in the dropdown for any user (verified for Stock On Hand, Stock Movement Ledger, Cycle Count Variance, Batch Traceability, and the construction inventory report).
