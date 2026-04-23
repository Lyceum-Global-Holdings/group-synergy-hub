

## Fix: Multi-Company Sub-Location Allocations Not Fully Visible (e.g. Lyceum Anuradhapura)

### Root cause (verified against DB)

`Lyceum Anuradhapura` is correctly mapped to **2 companies** in `warehouse_location_companies`:
- `NCG Warehouse Solutions` (NWS)
- `Lyceum International Schools` (LIS)

But the table on `/admin/warehouse-management` shows only a subset because of **two compounding issues**:

1. **RLS hides mapping rows from admins who can't access every linked company.** Policy on `warehouse_location_companies`: `SELECT … USING (can_access_company(company_id))`. The bulk fetch in `WarehouseManagement.tsx` (lines 77–91) silently drops rows for companies the admin isn't a member of.
2. **The "Company" cell silently skips chips for companies missing from `useCompanies()`.** Line 516–522: `companies.find(c => c.id === cid)` → if the company isn't in the user's filtered list, `return null` and the badge disappears with no indication.

Net effect: a sub-location with 2 company allocations renders 0–1 chips depending on the admin's company access, so it *looks* like the allocation is broken. The data is fine — the **admin master-data view is over-filtered**.

### Standards alignment

- **ISO/IEC 27001 A.9.4.1 (Information access restriction)** — distinguishes *administrative metadata access* from *transactional data access*. Admin/master-data screens must expose the full configuration without granting operational data rights.
- **SAP Authorization Concept** — separation of *display-only configuration objects* (e.g. `S_TABU_DIS` for warehouse master data) from *data access objects*.
- **GS1 GMN / Master Data Sharing** — location master records should expose all their allocations to authorized maintainers (Super Admin / Admin) regardless of transactional scope.

### Solution — two layers

#### 1. DB: security-definer RPC for full master-data view

Create `get_all_warehouse_location_companies()` as `SECURITY DEFINER`, callable only by **Super Admin or Admin** (`has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'super_admin') OR is_super_admin(auth.uid())`). Returns the complete `(location_id, company_id)` set, bypassing the per-company RLS — appropriate because this is *configuration metadata*, not transactional data, and is gated to admin roles.

```sql
CREATE OR REPLACE FUNCTION public.get_all_warehouse_location_companies()
RETURNS TABLE (location_id uuid, company_id uuid)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT wlc.location_id, wlc.company_id
  FROM warehouse_location_companies wlc
  WHERE has_role(auth.uid(), 'admin')
     OR has_role(auth.uid(), 'super_admin')
     OR is_super_admin(auth.uid());
$$;
GRANT EXECUTE ON FUNCTION public.get_all_warehouse_location_companies() TO authenticated;
```

Add a parallel `get_all_companies_minimal()` returning `(id, name, code)` only — no PII / sensitive columns — gated to admins, so the admin UI can label every chip even for companies outside the admin's transactional scope. Keep `useCompanies()` untouched (still RLS-scoped for transactional flows).

```sql
CREATE OR REPLACE FUNCTION public.get_all_companies_minimal()
RETURNS TABLE (id uuid, name text, code text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT c.id, c.name, c.code FROM companies c
  WHERE has_role(auth.uid(), 'admin')
     OR has_role(auth.uid(), 'super_admin')
     OR is_super_admin(auth.uid())
  ORDER BY c.name;
$$;
GRANT EXECUTE ON FUNCTION public.get_all_companies_minimal() TO authenticated;
```

#### 2. Frontend: use the admin RPCs in the master-data screen

**`src/pages/admin/WarehouseManagement.tsx`**
- Replace the bulk `from('warehouse_location_companies').select(...)` query with `supabase.rpc('get_all_warehouse_location_companies')`.
- Add a sibling query to `supabase.rpc('get_all_companies_minimal')` for chip labelling. Build a `Map<id, {name, code}>` and use it (with `useCompanies()` as fallback) when rendering the Company cell.
- On unknown company IDs, render a neutral chip with the short UUID instead of returning `null` — guarantees mismatches are visible, not silently swallowed.
- Keep the **edit dialog's** company picker (`companies` from `useCompanies`) unchanged — admins can only assign companies they themselves can access (correct security boundary).

#### 3. Sub-location parent-inheritance hint (UX only)

For `sublocation` / `department` rows, if their direct allocation set is empty, show a muted secondary chip "via {ParentName}" listing the parent's allocations, with a tooltip "Inherited from parent location". This matches **SAP MM storage-bin → storage-location** inheritance display pattern. Pure presentation — no data change, no permission change.

### Files modified

| File | Change |
|---|---|
| New migration | Create `get_all_warehouse_location_companies()` and `get_all_companies_minimal()` security-definer RPCs gated to admin/super-admin roles. |
| `src/pages/admin/WarehouseManagement.tsx` | Switch the two bulk queries to the new RPCs; render unknown companies with a fallback chip instead of `null`; add parent-inheritance "via {Parent}" chips for sub-locations with no direct allocations. |

### What does NOT change

- RLS on `warehouse_location_companies` stays as-is (transactional scoping preserved).
- `useCompanies()` and all other consumers (`LocationSelector`, `useWarehouseAssets`, `InventoryItems`, etc.) — untouched.
- Edit dialog assignment surface — admins still cannot assign companies they lack access to.
- DB schema for locations / mapping — no column changes.
- Existing data — no migration of rows.

### Verification after deploy

- Open `/admin/warehouse-management` as the same admin → `Lyceum Anuradhapura` row shows **both** `NWS` and `LIS` chips.
- Other multi-company sub-locations (`Lyceum Nugegoda`, `Lyceum Kurunegala`, `Lyceum Nugegoda Quarters`) show their full chip sets.
- Non-admin users hitting the page (already RBAC-blocked from `/admin/*`) get an empty result from the RPC — no privilege escalation.

