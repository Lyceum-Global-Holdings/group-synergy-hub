

# Fix: Bulk Stock Upload should match items from Item Master (Catalog)

## Problem

The Bulk Stock Upload currently matches `item_code` against `warehouse_items` (company-specific inventory). If an item exists in the global Item Master (`warehouse_item_catalog`) but hasn't been imported into the company's inventory yet, it shows "Item Not Found."

The "Import from Catalog" dialog works correctly because it queries `warehouse_item_catalog` first, then creates/restores the company inventory entry.

## Solution

Change the matching logic in `BulkStockUploadDialog.tsx` to:

1. **Match `item_code` against `warehouse_item_catalog`** (global catalog) instead of `warehouse_items`
2. **For each matched catalog item**, check if a `warehouse_items` row already exists for this company (by `catalog_item_id` or `item_code`)
3. **If inventory row exists** → use it directly for bin allocation
4. **If inventory row doesn't exist** → auto-create it (same insert logic as `AddFromCatalogDialog`) during import
5. Then proceed with bin allocation upsert and stock transaction as before

## File to modify

| File | Change |
|------|--------|
| `src/components/warehouse/BulkStockUploadDialog.tsx` | Change item matching from `warehouse_items` to `warehouse_item_catalog`, add auto-import logic during the import step |

## Technical details

**Validation phase** (existing `handleFileUpload`):
- Replace the `warehouse_items` query with a `warehouse_item_catalog` query matching on `item_code` (case-insensitive, status = active)
- Store catalog item details (id, name, item_code, and all fields needed for inventory insert) in the parsed rows
- Also fetch existing `warehouse_items` for the company to know which items need auto-import vs which already exist

**Import phase** (existing `handleImport`):
- For each matched row, check if a `warehouse_items` entry exists for the company (by `catalog_item_id` or `item_code`)
- If not, insert a new `warehouse_items` row (mirroring `AddFromCatalogDialog`'s insert logic with catalog fields)
- If exists but was zeroed out, reactivate it (like the catalog dialog's restore logic)
- Then proceed with bin allocation upsert and stock transaction as before

**Preview status** will gain a new indicator: "New to inventory" vs "Already in inventory" so the user can see which items will be auto-imported.

This is a single-file change. The matching, auto-import, and upsert logic all stay within `BulkStockUploadDialog.tsx`.

