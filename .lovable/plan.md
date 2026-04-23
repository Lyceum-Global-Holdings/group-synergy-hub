
## Fix selected-company location dropdowns so they always show the effective location hierarchy

### Exact issue

This is not a missing-data problem.

Verified facts:
- The database already has effective locations for the affected companies:
  - `NWS` has effective locations
  - `LIS` has effective locations
  - `LGH` has effective locations
- The current user is `super_admin`, so company access should not block the picker.
- The current implementation still has two competing sources of truth:
  1. `get_effective_location_company_ids(location_id)` — already works
  2. `get_effective_locations_for_company(...)` / `...for_companies(...)` — re-implements hierarchy resolution separately

That duplication is the main risk. When the “list RPC” drifts from the proven “effective company IDs” resolver, dropdowns can return zero rows even though the data is valid.

A second issue is UX masking:
- `LocationSelector` disables the select when `locations.length === 0`
- there is no visible loading/error state
- if the RPC path fails or returns empty, the UI looks like “no locations exist”

### Best-practice solution

Adopt one real canonical server-side read model:

```text
warehouse_locations
  -> get_effective_location_company_ids(location_id)   (single company-membership truth)
  -> get_effective_locations_for_company(company_id)   (list builder using that truth)
  -> get_effective_locations_for_companies(company_ids) (union builder using that truth)
  -> shared React hooks
  -> all company-scoped dropdowns
```

This follows:
- ISO 8000: one authoritative master-data derivation path
- SAP EWM/WM: hierarchy-aware location visibility from one resolver
- ISO/IEC 27001 A.9: company access enforced server-side without relaxing raw table RLS

## Changes to implement

### 1) Rewrite the canonical list RPCs to reuse the proven effective-company resolver

Replace the current recursive logic inside:
- `public.get_effective_locations_for_company(uuid)`
- `public.get_effective_locations_for_companies(uuid[])`

with a simpler canonical filter based on:

```sql
exists (
  select 1
  from public.get_effective_location_company_ids(wl.id) ec
  where ec.company_id = p_company_id
)
```

and for multi-company:

```sql
exists (
  select 1
  from public.get_effective_location_company_ids(wl.id) ec
  where ec.company_id = any(v_accessible)
)
```

The RPC should:
- return active rows only
- return `location`, `sublocation`, and `department`
- return `id`, `name`, `type`, `parent_id`, `depth`
- compute `depth` only for display/sorting, not for company membership
- order parent before child consistently

This removes duplicated inheritance logic and makes the list RPC mathematically consistent with the already-working company-resolution function.

### 2) Keep every dropdown on the shared hooks only

Preserve and standardize these hooks as the only read path:
- `useEffectiveLocationsForCompany`
- `useEffectiveLocationsForCompanies`
- `useDashboardLocations`

No component should query `warehouse_location_companies` directly for picker contents.

### 3) Fix picker UX so failures are visible instead of looking like “no locations exist”

Update:
- `src/components/common/LocationSelector.tsx`
- `src/pages/Dashboard.tsx`

So they show:
- loading state while the RPC is in flight
- explicit empty state when a company truly has no mapped locations
- explicit error state if the RPC fails

Do not silently disable the selector with a blank result.

### 4) Align cache invalidation with the real query keys

Current invalidation still targets `header-locations`, but the active hook key is:
- `effective-locations-for-company`
- `effective-locations-for-companies`
- `dashboard-locations`

Update invalidation in location/company assignment flows so dropdowns refresh immediately after admin changes.

### 5) Verify the canonical resolver against real company cases

Test with the exact cases already discussed:
- `NCG Warehouse Solutions (NWS)`
- `Lyceum International Schools (LIS)`
- `Lyceum Global Holdings (LGH)`

Expected result:
- selecting any of those companies returns non-zero rows
- inherited sublocations are included
- explicit multi-company sublocations are included
- admin warehouse management and header/dashboard pickers agree

## Files to modify

- `supabase/migrations/...`  
  Recreate `get_effective_locations_for_company(uuid)` and `get_effective_locations_for_companies(uuid[])` on top of `get_effective_location_company_ids(uuid)`

- `src/hooks/useWarehouseLocations.ts`  
  Keep hooks canonical; ensure query keys and return typing align with the rewritten RPCs

- `src/components/common/LocationSelector.tsx`  
  Add explicit loading/error/empty handling and keep hierarchical rendering

- `src/pages/Dashboard.tsx`  
  Same explicit handling for company-scoped location list

- `src/hooks/useLocationCompanies.ts`
- `src/hooks/useUserLocationPermissions.ts`  
  Align invalidation to actual effective-location query keys

## Verification after implementation

1. Open `/admin/warehouse-management`
2. Select `NWS` in the company selector
   - header location dropdown shows locations
3. Select `LIS`
   - `Lyceum Anuradhapura` and other valid sublocations appear
4. Select `LGH`
   - all valid effective locations appear
5. Confirm network shows `POST /rpc/get_effective_locations_for_company`
6. Confirm no dropdown is blank unless the company truly has zero valid locations
7. Confirm admin assignment changes refresh dropdowns without manual reload

## Technical note

The key correction is architectural:

- keep `get_effective_location_company_ids(location_id)` as the single company-membership source of truth
- make all list-style RPCs derive from it
- never duplicate hierarchy/company resolution logic in multiple SQL functions

That is the most reliable international-standard solution for multi-company master data with inherited location hierarchies.
