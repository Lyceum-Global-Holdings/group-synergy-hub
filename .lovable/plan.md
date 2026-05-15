# Bulk Bin Scope Management

## Goal

Add a bulk-scope action to **Bin Master** (`/warehouse/item-bin-master` → Bin Master tab) so an admin can take one or more bins and **clone or extend their scope** across multiple companies, locations, and sub-locations in a single operation. The same physical bin code (e.g. `A1-01`) often exists in different sites; this lets us register that fact in one click instead of N create-bin clicks.

## International standard alignment

- **GS1 / WMS practice (SAP EWM "Storage Bin", Oracle WMS "Locator")**: a bin code is unique only within a Storage Type / Location, never globally. Same bin code in a different location is a different physical bin. Our schema already follows this (`warehouse_bins` is keyed by `id`, scoped by `location_id` + `company_id`, with `is_global_template` flag for cross-tenant templates).
- **Action model**: bulk operation produces one `warehouse_bins` row per (bin_code, company_id, location_id) tuple — never moves stock, never merges bins. This matches SAP "Mass Maintenance" (LX25 / LS04) semantics.
- **Audit**: every cloned row carries `created_by`, `created_at`, and inherits attributes (capacity, type, status) from the source. An audit entry is logged.

## UX

In `BinMasterTab`:

1. Add row-level checkboxes + a header "select all (filtered)" checkbox.
2. When ≥1 bin selected, show a sticky toolbar: `N bins selected · [Change Scope] · [Clear]`.
3. `Change Scope` opens a new `BulkBinScopeDialog` with:
   - **Source bins** summary (codes + current locations).
   - **Target companies** multi-select (from `companies` the user can access).
   - **Target locations** hierarchical multi-select (reusing `buildLocationOptions` from `src/lib/warehouse/locationHierarchy.ts` — locations + sub-locations + departments, indented with type badges). Filter by selected companies.
   - **Mode** radio:
     - `Clone` (default) — keep existing rows, add new ones for missing (company, location) tuples.
     - `Replace` — delete existing rows in non-selected scopes for these bin codes (only if they have zero allocations; rows with stock are skipped with a warning).
   - **Mark as global template** checkbox (sets `is_global_template = true` on all resulting rows when scope spans >1 company).
   - Live preview table: `bin_code · company · location · status (new / existing / skipped-has-stock)`.
   - Confirm button disabled until ≥1 new row will be created.

## Technical implementation

### Files to add

- `src/components/warehouse/BulkBinScopeDialog.tsx` — new dialog described above.
- `src/hooks/warehouse/useBulkBinScope.ts` — mutation that calls the RPC, invalidates `['warehouse-bins']` and `['bin-allocations']`.

### Files to edit

- `src/components/warehouse/BinMasterTab.tsx` — add selection state, header/row checkboxes, sticky bulk-action bar, mount new dialog.
- `src/lib/warehouse/locationHierarchy.ts` — extend `buildLocationOptions` to optionally filter by `companyIds[]` (already supports all types).

### Database (single migration)

New SECURITY DEFINER RPC `public.bulk_clone_bin_scope(_bin_ids uuid[], _company_ids uuid[], _location_ids uuid[], _mode text, _global boolean)` returning `jsonb { created: int, skipped: jsonb[] }`:

1. Authorize: caller must have admin role (`has_role(auth.uid(),'admin')` or super_admin) — reject otherwise.
2. For each source bin, build the cartesian product `{company × location}` filtered to scopes the caller can access (`can_access_company`, location permission view).
3. Insert missing rows into `warehouse_bins` with `ON CONFLICT (bin_code, company_id, location_id) DO NOTHING`.
4. If `_mode = 'replace'`: for each source `bin_code`, delete rows whose (company, location) is **not** in the new target set **and** have zero `warehouse_bin_allocations`; collect skipped rows with stock into the `skipped` array.
5. Insert one row into `audit_logs` (action `bulk_bin_scope_change`, payload = inputs + result counts).
6. Add a unique index `warehouse_bins_code_company_location_uniq` on `(bin_code, company_id, location_id)` if not already present (required for `ON CONFLICT`).

RLS unchanged — RPC is SECURITY DEFINER and re-checks admin + tenant access internally.

### Out of scope

- No stock movement, no allocation merging, no QR re-print flow (those continue to work per-bin via existing pages).
- No change to `CreateBinDialog`, GRN, or putaway flows.
- No background job — operation is synchronous; expected volume <1000 rows per call.

## Verification

1. As admin, select 3 bins from one location → open dialog → pick 2 companies + 4 sub-locations → preview shows 24 rows with correct new/existing breakdown → confirm → new rows visible in Bin Master after invalidation.
2. Run `Replace` mode on a bin that has allocations elsewhere → those rows appear in `skipped` toast, not deleted.
3. Non-admin user does not see the bulk-action bar; direct RPC call returns permission error.
4. Re-running the same clone is a no-op (ON CONFLICT DO NOTHING; `created: 0`).
