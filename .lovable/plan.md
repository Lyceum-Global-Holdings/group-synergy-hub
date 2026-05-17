## Goal
Let users export the item codes generated in the Bulk Create Items grid so they can paste them back into Excel or save a CSV.

## Change (single file)
Edit `src/components/warehouse/bulk-item-master/BulkItemMasterDialog.tsx`:

1. Add two new toolbar buttons next to "Reset":
   - **Copy codes** (`Copy` icon) — copies a TSV to clipboard with columns: `Item Code`, `Name`, `Category`, `UoM`. Includes every row that has a resolved code (auto or manual). Toast on success.
   - **Download CSV** (`Download` icon) — triggers a CSV download (`item-codes-YYYYMMDD-HHmm.csv`) with the same columns, properly quoted.

2. Helpers (inline in the file):
   - `resolveCodeForRow(row)` → `row.item_code?.trim() || row.auto_item_code || ''`
   - `buildExportRows()` → maps rows with a non-empty resolved code to `{ code, name, category, uom }` using `categories` / `units` lookup maps.
   - `toCsv(rows)` with RFC 4180 quoting, UTF-8 BOM prefix for Excel compatibility.
   - `toTsv(rows)` for clipboard.

3. Buttons disabled when no exportable codes exist. Counter shown in tooltip ("Export N codes").

## Out of scope
- No changes to `useBulkItemMaster`, classifier, or DB layer.
- No new dependency — uses `navigator.clipboard` and a Blob + anchor download.
- Codes for rows where the user hasn't picked a category yet (no `auto_item_code`) are simply skipped.
