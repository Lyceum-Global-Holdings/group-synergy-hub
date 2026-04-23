

## Fix: Sub-locations with multi-company allocations missing from the global Location dropdown

### Root cause (verified)

Two bugs in the dropdown query path — both in the same data layer:

1. **`src/components/common/LocationSelector.tsx` (line 32) and `src/hooks/useWarehouseLocations.ts` `useDashboardLocations` (line 209)** both hard-filter to `type = 'location'`, so `sublocation` and `department` rows are **never returned**, regardless of company assignment.
2. Both queries read `warehouse_location_companies` directly. With the new hierarchical model, child rows in `inherit_parent` mode have **no direct row** in that junction table — their effective company comes from the parent. So even after we include sub-locations, RLS-scoped reads of the junction will miss every inherited child.

Result: a sub-location like `Lyceum Anuradhapura - Floor 2` (multi-company via inheritance or explicit) is invisible in the header / dashboard pickers.

### Fix — single resolver, two consumers

#### 1) DB: add a non-admin, company-scoped effective-resolver RPC

The existing `get_all_effective_location_companies()` is admin-only. Add a sibling that any authenticated user can call, scoped to a single company and respecting the same `can_access_company` boundary used elsewhere:

```sql
CREATE OR REPLACE FUNCTION public.get_effective_locations_for_company(p_company_id uuid)
RETURNS TABLE (id uuid, name text, type text, parent_id uuid)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT can_access_company(p_company_id) THEN RETURN; END IF;

  RETURN QUERY
  WITH RECURSIVE chain AS (
    SELECT wl.id AS origin_id, wl.id AS current_id,
           wl.company_assignment_mode, wl.parent_id, 0 AS depth
      FROM warehouse_locations wl
      WHERE wl.status IS DISTINCT FROM 'inactive'
    UNION ALL
    SELECT c.origin_id, wl.id, wl.company_assignment_mode, wl.parent_id, c.depth + 1
      FROM chain c JOIN warehouse_locations wl ON wl.id = c.parent_id
     WHERE c.company_assignment_mode = 'inherit_parent' AND c.depth < 20
  ),
  resolved AS (
    SELECT DISTINCT ON (origin_id) origin_id, current_id
      FROM chain
     WHERE company_assignment_mode = 'explicit' OR parent_id IS NULL
     ORDER BY origin_id, depth ASC
  ),
  matched AS (
    SELECT DISTINCT r.origin_id
      FROM resolved r
      JOIN warehouse_location_companies wlc
        ON wlc.location_id = r.current_id AND wlc.company_id = p_company_id
    UNION
    -- legacy fallback for rows still using warehouse_locations.company_id
    SELECT wl.id FROM warehouse_locations wl WHERE wl.company_id = p_company_id
  )
  SELECT wl.id, wl.name, wl.type, wl.parent_id
    FROM warehouse_locations wl
    JOIN matched m ON m.origin_id = wl.id
   ORDER BY wl.type DESC, wl.name;  -- top-level first, then children
END;
$$;
GRANT EXECUTE ON FUNCTION public.get_effective_locations_for_company(uuid) TO authenticated;
```

This returns **every location (any type)** whose effective company set contains `p_company_id`, including sub-locations inheriting from a multi-company parent. Aligned with **SAP EWM hierarchy resolution** and **ISO 8000 master-data inheritance**.

#### 2) Frontend: switch both pickers to the resolver

**`src/components/common/LocationSelector.tsx`**
- Replace the `mappedRows + legacyRows` query block with a single `supabase.rpc('get_effective_locations_for_company', { p_company_id: selectedCompany.id })`.
- Drop the `type = 'location'` constraint so sub-locations / departments appear.
- Render with a small visual hint for non-top-level rows (indent or "↳" prefix using `parent_id`) so the hierarchy is readable in the dropdown — matches SAP Fiori master-data picker pattern.
- Keep the existing permission overlay (`viewAllLocations`, `viewLocationIds`, `editLocationIds`) and the fail-open visibility unchanged.

**`src/hooks/useWarehouseLocations.ts` (`useDashboardLocations`)**
- Same RPC swap. Remove the `type = 'location'` and the `or(company_id.eq..., is.null)` legacy clauses (both now handled inside the RPC).
- Keep the no-company branch (returns all locations) for the unfiltered dashboard view.

#### 3) Cache invalidation

`useLocationCompanies.ts` already invalidates `header-locations` and `dashboard-locations` after admin saves — no change needed; the new RPC results flow through the same cache keys.

### Files modified

| File | Change |
|---|---|
| New migration | Add `get_effective_locations_for_company(uuid)` SECURITY DEFINER RPC, gated by `can_access_company`. |
| `src/components/common/LocationSelector.tsx` | Switch query to the new RPC; remove `type='location'` filter; render hierarchy hint for child rows. |
| `src/hooks/useWarehouseLocations.ts` | Update `useDashboardLocations` to use the new RPC; same removal of `type='location'` filter. |

### Not changed

- RLS on `warehouse_location_companies` — untouched.
- Admin-only `get_all_effective_location_companies()` — untouched (still powers `WarehouseManagement.tsx`).
- `useLocationCompanies` write path, `LocationManagementDialog`, RBAC, and permission gating — all untouched.

### Standards alignment

- **ISO 8000** — master-data completeness via inheritance resolution at the read boundary.
- **SAP EWM / WM** — storage-bin and storage-location hierarchy surfaces inherited assignments to operational pickers.
- **ISO/IEC 27001 A.9.4.1** — visibility scoped through `can_access_company`, no broad RLS relaxation.

### Verification

1. Pick a company that has `Lyceum Anuradhapura` as a sub-location with multi-company allocation → it appears in the header dropdown.
2. Pick `LIS` → both `Lyceum Anuradhapura` (sub-location) and its parent appear.
3. Sub-locations like `LNQ-1F`…`LNQ-5F` (inherit_parent) appear under the company their parent is mapped to.
4. Non-admin users with explicit location permissions still see only their permitted subset (no privilege escalation).

