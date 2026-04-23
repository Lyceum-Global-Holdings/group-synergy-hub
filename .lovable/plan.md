
## Fix company-selected location lists so all valid locations appear consistently

### Outcome

When a company is selected, every location picker that is supposed to be company-scoped will show the full correct location set for that company:

- top-level locations
- explicit multi-company sub-locations
- inherited child locations
- no silent fallback to unrelated top-level locations
- consistent results across header, dashboard, construction inventory, and admin assignment screens

### Root cause

The app currently has **multiple competing location query paths** instead of one canonical resolver:

1. **Some screens use the new effective-company resolver**, but others still query `warehouse_location_companies` directly.
2. Several consumers still hard-filter to `type = 'location'`, which excludes child locations.
3. **`Dashboard.tsx` is not passing the selected company into `useDashboardLocations()`**, so its dropdown is not actually synced to the active company context.
4. `useLocationsForCompanies()` and other admin/location pickers still use the old direct-junction logic, so multi-company and inherited children are dropped.
5. The current “fallback to all top-level locations” masks resolver failures and breaks company-scoped master-data integrity.

This violates single-source-of-truth master-data practice and is why the user keeps seeing “some locations missing” after each partial fix.

## Best-practice solution

Adopt a **single canonical effective-location read model** for all company-scoped dropdowns, aligned with:

- **ISO 8000** — master-data completeness and consistency
- **SAP EWM / WM hierarchy practice** — operational pickers must resolve the location hierarchy from one authoritative source
- **ISO/IEC 27001 A.9** — company visibility enforced server-side, without broadening raw table access

## Changes to implement

### 1) Database: standardize effective location resolution

Create or revise database RPCs so every location picker consumes the same logic:

#### A. Replace/upgrade `get_effective_locations_for_company(...)`
Return all active locations effectively mapped to one company, including:

- `location`
- `sublocation`
- `department`

Return:
- `id`
- `name`
- `type`
- `parent_id`
- `depth` or hierarchy metadata for ordering/rendering

Rules:
- respect `can_access_company(p_company_id)`
- resolve `inherit_parent` chains server-side
- include explicit multi-company children
- exclude inactive rows
- order parent before child

#### B. Add `get_effective_locations_for_companies(...)`
Needed for admin/user-assignment flows that union multiple accessible companies.

Use case:
- `useLocationsForCompanies()` in user permission editor
- any multi-company picker currently merging direct junction rows client-side

This avoids re-implementing company-union logic in React.

### 2) Frontend: create one shared company-location data path

Refactor company-scoped location fetching into a single reusable hook/helper, for example in `src/hooks/useWarehouseLocations.ts`.

That shared hook should:
- call the effective-location RPC
- accept one company or many companies
- optionally support `includeChildren`
- return already-sorted results
- never fallback to unrelated top-level locations

This becomes the only read path for dropdowns tied to selected company context.

### 3) Fix the currently inconsistent consumers

Update these files to use the shared effective-location source:

#### `src/components/common/LocationSelector.tsx`
- keep company-scoped behavior
- remove legacy fallback query to `.eq("type", "location")`
- render hierarchy hints for children
- if permissions are applied, filter against the resolved set only

#### `src/hooks/useWarehouseLocations.ts`
- make `useDashboardLocations(selectedCompanyId)` rely on the shared effective-location hook/RPC
- remove the fallback to all top-level locations

#### `src/pages/Dashboard.tsx`
- pass `selectedCompany?.id` into `useDashboardLocations(...)`
- ensure the dashboard dropdown actually tracks the selected company

#### `src/pages/construction/resources/InventoryItems.tsx`
- replace direct `warehouse_location_companies` + legacy `company_id` merge logic
- use the same canonical effective location source

#### `src/components/warehouse/AssignLocationDialog.tsx`
- stop querying only direct top-level company locations
- use the effective resolver so multi-company/inherited valid targets appear

#### `src/hooks/useUserLocationPermissions.ts`
- replace `useLocationsForCompanies()` direct junction-table logic
- use the new bulk effective-location RPC
- ensure admin user editors see the real location union for assigned companies

### 4) Permission overlay: make hierarchical visibility deterministic

For users with explicit location grants, avoid exact-ID-only filtering if the business rule is hierarchical visibility.

Implement a small shared helper that expands permitted IDs through the loaded tree:

- if user has access to a parent location and hierarchical visibility is intended,
  include its descendants in the visible picker set
- if no explicit permissions exist, preserve the current fail-open behavior
- admin and super admin continue to see all effective locations

This prevents effective child locations from being fetched and then immediately hidden by client-side exact-ID filtering.

### 5) Remove unsafe masking behavior

Delete the current “if RPC returns zero rows, show all top-level locations” behavior from company-scoped dropdown paths.

Replace it with:
- empty result state when genuinely no company locations exist
- optional warning/logging for debugging

This preserves strict company isolation and avoids showing locations from other company scopes.

## Files to modify

- New SQL migration in `supabase/migrations/`
- `src/components/common/LocationSelector.tsx`
- `src/hooks/useWarehouseLocations.ts`
- `src/pages/Dashboard.tsx`
- `src/pages/construction/resources/InventoryItems.tsx`
- `src/components/warehouse/AssignLocationDialog.tsx`
- `src/hooks/useUserLocationPermissions.ts`

Potential follow-up audit targets if they also behave inconsistently:
- `src/hooks/useWarehouseAssets.ts`
- any remaining dropdowns still querying `warehouse_location_companies` directly

## Verification

After implementation, verify all of the following:

1. Select a company in the header:
   - header location dropdown updates immediately
   - dashboard location dropdown shows the same company-scoped set
2. `Lyceum Anuradhapura` appears when selecting both relevant companies where it is valid.
3. Inherited child locations (for example floors/departments under a mapped parent) appear without requiring direct junction rows.
4. Construction Inventory location dropdown matches the same effective company-scoped set.
5. Assign Location dialog shows the same valid company-scoped locations.
6. Admin user permission editor lists the full effective location union for the user’s assigned companies.
7. No unrelated top-level locations appear when a company has zero valid mappings.

## Technical details

```text
Canonical model
Selected Company
   -> effective-location RPC
      -> resolve explicit + inherit_parent
      -> enforce can_access_company()
      -> return active hierarchy
   -> shared React hook
      -> used by all company-scoped dropdowns
```

### Standards applied

- **ISO 8000**: one authoritative master-data resolution path
- **SAP EWM / WM**: hierarchy-aware location resolution for operational pickers
- **ISO/IEC 27001 A.9**: access restricted server-side by company context, not widened by client fallbacks

### Important constraints

- Do not relax RLS on `warehouse_location_companies`
- Do not reintroduce direct client-side merging of raw junction-table rows for dropdowns
- Do not keep the top-level fallback in company-scoped selectors
- Keep admin metadata visibility separated from transactional company access
