
# Stock Owner as Free-Text Label

Decouple Stock Owner from the `companies` table. It becomes a plain text label (like `brand`) that you type freely, never combined with a company ID.

## Data model

Add `stock_owner` (text, nullable) to `warehouse_bin_allocations`. Keep the existing `company_id` column intact (it still records which tenant the row belongs to for RLS/tenant isolation), but Stock Owner displayed in the UI is driven exclusively by the new free-text column.

```sql
ALTER TABLE warehouse_bin_allocations
  ADD COLUMN stock_owner text;

CREATE INDEX idx_wba_stock_owner
  ON warehouse_bin_allocations (company_id, stock_owner);
```

No backfill from `companies.name` — existing rows start with `stock_owner = NULL` ("Unassigned") and are populated as users type values.

## RPC: rename + retype

Replace `bulk_change_stock_owner(_from_company uuid, _to_company uuid, ...)` with:

```
bulk_change_stock_owner(
  _item_ids uuid[],
  _from_owner text,         -- NULL means "match rows with no owner"
  _to_owner   text,         -- NULL clears the owner
  _location_ids uuid[]      -- mandatory, scope-restricted
)
```

Behavior:
- Trims `_to_owner`; rejects empty string (treats as NULL only when explicitly passed).
- Updates `warehouse_bin_allocations.stock_owner` from `_from_owner` → `_to_owner` for matching `item_id` + `location_id`.
- Merge logic: if a row with same (item, bin, location, `_to_owner`) already exists, sum quantities and delete the source row.
- Still restricted to admin/super_admin and to the caller's accessible companies.
- `_location_ids` remains mandatory — no system-wide changes.

## Reader: `list_warehouse_inventory`

- Replace `_owner_company_id uuid` parameter with `_owner_label text`.
- Replace `owner_company_ids uuid[]` / `owner_company_names text[]` output with a single `stock_owners text[]` (distinct labels visible per item in scope, NULLs surfaced as the string `"Unassigned"`).

## Frontend changes

### `BulkChangeStockOwnerDialog.tsx`
- Remove both `<Select>` components and the `useCompany` import.
- Replace with two `<Input>` fields: **From (current owner)** and **To (new owner)**, both free text.
- Validation: `to` is required and non-empty (after trim); `from` may be empty to mean "rows with no owner".
- Submit calls the new RPC signature with text values.
- Keep the location-scope chip + warning exactly as today.

### Inventory tab (`ItemMasterTab.tsx` + `useWarehouseInventoryPage.ts`)
- Stock Owner filter becomes a free-text input (debounced), not a company dropdown.
- The Stock Owner column renders the `stock_owners` text array as badges; rows with no owner show a muted "Unassigned" badge.

### Bulk Update dialog (`BulkInventoryUpdateDialog.tsx`)
- Stock Owner filter input becomes a plain text field (matches the column type).
- Still filter-only — no ownership writes from this dialog.

### Types
- Update `src/types/itemBin.ts` and any helpers that reference `owner_company_ids` / `owner_company_names` to use the new `stock_owners: string[]` shape.

## Out of scope

- No changes to `warehouse_bin_allocations.company_id` (tenant isolation stays).
- No changes to RLS policies beyond keeping admin/tenant checks intact in the new RPC.
- No data migration / autofill of existing rows.
- No changes to other warehouse modules (GRN, transfer, audit, picking) — they continue to write `company_id` for tenant isolation and ignore the new `stock_owner` label until set.

## Files touched

- `supabase/migrations/<new>.sql` — add column + index, drop & recreate `bulk_change_stock_owner`, alter `list_warehouse_inventory`.
- `src/components/warehouse/BulkChangeStockOwnerDialog.tsx`
- `src/components/warehouse/ItemMasterTab.tsx`
- `src/components/warehouse/BulkInventoryUpdateDialog.tsx`
- `src/hooks/useWarehouseInventoryPage.ts`
- `src/hooks/useWarehouseItemsLazyInventory.ts`
- `src/types/itemBin.ts`
- `.lovable/memory/architecture/stock-owner-vs-item-company.md` — rewrite to reflect free-text owner.
