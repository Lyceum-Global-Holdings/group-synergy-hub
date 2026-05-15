# Bin Code Scoping — Location-specific vs Global

## Goal
When creating a bin, the user picks a scope:
- **Location-specific** — bin exists only in one chosen location (current behavior).
- **Global (shared code)** — the same `bin_code` is provisioned across one or more selected locations, so e.g. `A-01-01` can exist in both Lyceum Anuradhapura and LNPE without conflict.

This matches international WMS practice (SAP EWM "storage bin" per "storage type/location"; Oracle WMS "locator" per "subinventory"; GS1 SSCC/GLN logical scoping). A bin code is a **logical label**; the **physical bin** is `(location, bin_code)`. Globally shared codes are modeled as multiple physical bins sharing one code, not one row pointing at many locations — this preserves stock isolation per location and keeps QR labels unambiguous.

## Database (current state — no schema change required)
`warehouse_bins` already has:
- `location_id uuid NULL`
- `UNIQUE (bin_code, location_id)`

This already permits the same `bin_code` across different locations. We will:
1. Add a small `is_global_template boolean DEFAULT false` flag on `warehouse_bins` so users can later see/manage which bins were provisioned as part of a global rollout (purely informational; does not affect stock).
2. Add a partial unique index to prevent two "global template definitions" from colliding per company:
   `CREATE UNIQUE INDEX warehouse_bins_global_code_uniq ON warehouse_bins (company_id, bin_code) WHERE is_global_template = true AND location_id IS NULL;`
   (Optional — only used if we keep a "template row" with NULL location.)
3. Keep stock, allocations, and QR codes scoped to the concrete `(location_id, bin_code)` row, unchanged.

We will **not** introduce a many-to-many bin↔location table. Stock ledgers, FIFO, and bin-allocation memory rules all assume one bin = one physical place.

## UI changes — `CreateBinDialog.tsx`
1. Add a **Scope** radio group at the top:
   - `Location-specific` (default)
   - `Global (apply to multiple locations)`
2. When **Location-specific**: show single `Location` Select (current behavior).
3. When **Global**: replace single Select with a multi-select location picker (checkbox list grouped by parent location, reusing `LocationSelector` styling). On submit, the dialog calls `createBin` once per selected location — each row gets the same `bin_code`, `name`, `capacity`, `status`, plus `is_global_template = true`. Failures on individual locations are reported per-row in a toast summary.
4. Edit mode keeps single-location editing (you edit the concrete physical bin, not the template).

## Hook changes — `useWarehouseBins.ts`
- Extend the `createBin` mutation to accept either a single payload or `{ locationIds: string[], ...rest }` and fan out inserts in a single Supabase call (`insert([...])`). Surface partial-failure errors.
- No change to `updateBin` / `deleteBin`.

## Validation rules
- Bin code: required; trimmed; uppercased; pattern `^[A-Z0-9][A-Z0-9\-]*$` (GS1-friendly, no spaces).
- Global scope must select ≥ 1 location.
- Per `(location_id, bin_code)` collisions are caught by the existing unique constraint and reported per row.

## Out of scope
- No migration of existing bins.
- No changes to QR labels, allocations, or stock movement logic.
- No cross-location stock pooling — global only means the **code** is shared, not the inventory.

## Files to touch
- `supabase/migrations/<new>.sql` — add `is_global_template` column + partial unique index.
- `src/components/warehouse/CreateBinDialog.tsx` — scope toggle + multi-location picker.
- `src/hooks/useWarehouseBins.ts` — bulk create support.
- `src/types/itemBin.ts` — add `is_global_template?: boolean`.
- `src/components/warehouse/BinMasterTab.tsx` — optional badge "Global" on rows where `is_global_template`.
