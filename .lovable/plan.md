# Excel-View Inventory Import

Add a spreadsheet-style editor on the Inventory page where users type/paste rows like Excel, validate inline, and commit catalog items **plus opening stock** (company / location / bin) in a single transaction. International-standards aligned (GS1 GTIN barcode, UNSPSC-friendly category, ISO UoM, IFRS opening-stock journal via existing stock_transactions trigger).

## UX

New button on `/warehouse/inventory` → **"Add via Excel"** opens a full-screen sheet with a Handsontable-style editable grid.

Columns (in two color-banded groups):

**Catalog (global)**
- `item_code` (blank = auto-generate INV-{CAT}-{NNN})
- `name *`, `description`, `category *`, `unit *` (ISO UoM abbrev), `barcode` (GTIN-8/12/13/14 checksum validated), `sku`, `brand`, `manufacturer`, `is_serialized`, `is_batch_tracked`, `unit_cost`, `selling_price`, `reorder_level`, `min_stock_level`, `max_stock_level`, `status`

**Opening stock (per-company, optional per row)**
- `company *` (defaults to active company), `location *` (warehouse/sublocation), `bin` (optional), `opening_qty`, `batch_no` (if batch-tracked), `expiry_date`, `serial_numbers` (semicolon-separated if serialized)

Features:
- Paste from Excel/Google Sheets (TSV)
- Add/remove rows, drag-fill, undo/redo
- Per-cell validation badges with hover tooltip
- Dropdown cells for category / unit / location / bin / company (typeahead)
- Bottom status bar: `X new · Y duplicates · Z errors`
- "Download .xlsx template" and "Import .xlsx" buttons populate the grid (uses existing `xlsx` lib pattern)
- "Validate" runs full validation; "Import" greyed until 0 errors

## Standards alignment

- **GS1 GTIN** check-digit validation on barcode
- **ISO 80000 / UN-CEFACT** unit abbreviations enforced from `item_units`
- **UNSPSC-friendly** 3-letter category code reused for auto item_code
- **IFRS opening balance**: opening stock booked via existing `stock_transactions` with `transaction_type='opening_balance'`, leveraging the qty_before/after trigger
- **Multi-tenant**: `company_id` mandatory on every stock row, RLS-enforced

## Technical

**Library:** `@silevis/reactgrid` (MIT, lightweight, paste-from-Excel support) — chosen over Handsontable (GPL/commercial). Add `xlsx` (already common) for file import/export of the template.

**Files**
- `src/components/warehouse/excel-import/` (new)
  - `InventoryExcelGrid.tsx` — grid wrapper + column defs + validation
  - `useInventoryExcelImport.ts` — parse, validate, autocode, commit
  - `excelColumns.ts` — column metadata, dropdown sources, validators (GTIN, ISO UoM)
  - `templateXlsx.ts` — download/import .xlsx using `xlsx`
- `src/components/warehouse/ExcelInventoryImportDialog.tsx` — full-screen dialog wrapper
- Button added to `Inventory.tsx` header

**DB migration** — new RPC `bulk_import_inventory_with_stock(p_rows jsonb)` (SECURITY DEFINER, company-scoped via `can_access_company`) that, per row:
1. Insert/upsert into `warehouse_item_catalog` (reuses `create_catalog_item` logic) — get `catalog_item_id`
2. If opening_qty > 0: call existing `upsert_warehouse_inventory` to get `warehouse_items` row
3. Insert `stock_transactions` row (`opening_balance`) — trigger updates `bin_allocations` + qty_before/after
4. Returns `{row_index, status, catalog_item_id, error}[]` so the grid can mark each row

Single RPC call wraps everything in one transaction; failures per row are reported back without aborting the batch (savepoints).

**Reuse**
- `allocateAutoCodes` from `src/lib/bulkImport` for item-code generation
- `parseCSV`/`downloadCSV` not needed (xlsx instead)
- All existing validation rules from `BulkItemImportContent` ported to `excelColumns.ts`

## Out of scope (this iteration)
- Editing existing items via the grid (insert-only); use existing Edit dialog
- Multi-bin per row (one bin per row; users add multiple rows for split allocation)
- Serial-number generation; users paste them explicitly

## Verification
- Paste 50 rows from Excel → all dropdowns resolve, validation flags bad GTINs / unknown categories
- Import .xlsx template → grid populates
- Commit → catalog rows created, `warehouse_items` rows created for the active company, `stock_transactions` opening_balance posted, bin allocations match opening_qty
- `/warehouse/inventory` list reflects new on-hand stock immediately (realtime + invalidation)
