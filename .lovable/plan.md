
# Bulk Catalog → Inventory Import (Table Grid)

Replace the current "Add via Excel" flow on `/warehouse/inventory` with a focused **Catalog → Inventory** bulk-provisioning grid. Users do NOT create new catalog items here; they pick existing ones and assign opening stock per location/bin.

## Standards alignment

- **GS1 GDSN / SAP MM**: separation of *item master* (catalog) from *plant/storage-location stock*.
- **IFRS / WMS opening-balance**: opening stock posted as `stock_transactions` with `transaction_type = 'opening_balance'`, scoped per (company, item, location, bin) — matches existing memory rule.
- **Idempotent batch import** with per-row status (success / skipped / error) — partial commits via savepoints.
- **One row per (item, location, bin)** — supports splitting a single catalog item across multiple storage locations in one import.

## UX — `BulkCatalogToInventoryDialog`

Full-screen Sheet opened from Inventory header button "Bulk add from catalog".

Grid columns (left → right):

| # | Column | Type | Notes |
|---|---|---|---|
| 1 | Item (code / name / GTIN) | Combobox picker | Async search via `list_warehouse_catalog` RPC. Shows code, name, UoM. |
| 2 | Catalog code | readonly | Auto-filled from picker. |
| 3 | UoM | readonly | From catalog. |
| 4 | Company | Combobox | Defaults to active company; admins can override. |
| 5 | Location | Combobox | Filtered by selected company; uses `warehouse_locations`. |
| 6 | Bin | Combobox | Filtered by location; uses `warehouse_bins`. Required when location is bin-managed. |
| 7 | Opening qty | number ≥ 0 | Defaults to 0; if 0, only provisions the `warehouse_items` row. |
| 8 | Unit cost | number ≥ 0 | Optional; defaults to catalog `standard_cost`. |
| 9 | Reorder level | number | Optional, sets per-company reorder. |
| 10 | Status | badge | pending / valid / error / imported (set after submit). |

Three input modes (all feed the same grid):

1. **Picker per row** — click a row's Item cell → searchable Combobox listing the global catalog (uses existing `useWarehouseCatalogPage`).
2. **Paste from Excel** — paste TSV: first column = item code OR GTIN; remaining columns map left-to-right to Location, Bin, Opening Qty, Unit Cost, Reorder. Unknown codes flagged red with "Not in catalog".
3. **Bulk add by codes** — textarea modal: paste a list of `item_code` / GTIN values → resolves into rows (one per code) ready for location/bin/qty.

Grid features:
- Inline validation (red border + tooltip), live valid/error counters in footer.
- Duplicate detection for `(item, company, location, bin)` within the grid.
- "+ Add row", row delete, "Clear invalid", "Download template (.xlsx)".
- "Validate" button runs server-side dry-run; "Import" commits.

## Backend — single RPC

`bulk_provision_inventory_from_catalog(p_rows jsonb)` (SECURITY DEFINER, search_path=public):

Each input row: `{ row_index, catalog_item_id | item_code | gtin, company_id, location_id, bin_id?, opening_qty, unit_cost?, reorder_level? }`.

Per-row, inside a savepoint:
1. Resolve catalog item by `catalog_item_id`, else `item_code`, else `gtin`. Error if not found / inactive.
2. Authorize: caller must have `can_access_company(company_id)`.
3. Validate location belongs to company; bin belongs to location.
4. Call existing `upsert_warehouse_inventory(...)` to create/find `warehouse_items` row for `(catalog_item_id, company_id, location_id)`. Apply `unit_cost`, `reorder_level` if provided.
5. If `opening_qty > 0` → insert `stock_transactions` row: `transaction_type='opening_balance'`, `item_id`, `location_id`, `bin_id`, `quantity = opening_qty`, `unit_cost`. Existing triggers update bin allocation and `qty_before/after` (per memory rule).
6. Return `{row_index, status: 'imported'|'skipped'|'error', warehouse_item_id, error}`.

Rollback per-row only; the batch always returns a full report (no full-transaction abort).

## Files

**New**
- `src/components/warehouse/bulk-catalog-import/BulkCatalogToInventoryDialog.tsx` — Sheet + grid orchestration.
- `src/components/warehouse/bulk-catalog-import/CatalogInventoryGrid.tsx` — table UI with paste handler.
- `src/components/warehouse/bulk-catalog-import/CatalogItemCell.tsx` — async combobox cell.
- `src/components/warehouse/bulk-catalog-import/LocationBinCells.tsx` — dependent dropdowns.
- `src/components/warehouse/bulk-catalog-import/PasteCodesDialog.tsx` — bulk paste of codes/GTINs.
- `src/components/warehouse/bulk-catalog-import/useCatalogInventoryImport.ts` — validation, resolve, submit hook.
- `src/components/warehouse/bulk-catalog-import/types.ts` + `validators.ts`.
- `supabase/migrations/<ts>_bulk_provision_inventory_from_catalog.sql` — new RPC + grants.

**Edited**
- `src/pages/warehouse/Inventory.tsx` — replace "Add via Excel" button with **"Bulk add from catalog"**, wire to new dialog. Remove `ExcelInventoryImportDialog` mount.

**Removed**
- `src/components/warehouse/ExcelInventoryImportDialog.tsx`
- `src/components/warehouse/excel-import/` (no longer needed; this flow doesn't create catalog items).

## Memory update
- Replace `mem://features/warehouse/excel-inventory-import` with `mem://features/warehouse/bulk-catalog-to-inventory` documenting: catalog-only source, opening_balance posting, multi-row per item, RPC name.

## Out of scope
- Creating new catalog items (use existing Add Item / Bulk Item Import flows).
- Editing existing on-hand stock (use Stock Audit / GRN).
- Serial-number generation.
