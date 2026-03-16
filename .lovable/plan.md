

# Separate Item Master and Inventory into 2 Tables

## Problem
All items live in `warehouse_items` with `company_id`. The "Import from Catalog" dialog queries the same table and filters out items belonging to the current company. Items created in "catalog mode" still get `company_id = selectedCompany.id`, making them invisible to other companies or incorrectly excluded from the same company's import.

## Solution: New `warehouse_item_catalog` Table

Create a dedicated global catalog table. Keep `warehouse_items` as the company-specific inventory table. All 23 existing foreign keys to `warehouse_items` remain untouched.

```text
warehouse_item_catalog (NEW - global definitions)
├── id, item_code (unique), name, description
├── category_id, unit_id, brand, manufacturer
├── barcode, sku, unit_cost, selling_price
├── reorder_level, min/max_stock_level
├── image_url, is_serialized, is_batch_tracked
├── status, notes, created_at, updated_at, created_by
└── NO company_id, NO current_stock, NO reserved_quantity

warehouse_items (EXISTING - company inventory)
├── catalog_item_id → warehouse_item_catalog(id)  [NEW FK]
├── company_id (required for inventory)
├── current_stock, reserved_quantity, available_quantity
├── All existing columns preserved
└── 23 FK references from other tables unchanged
```

## Migration

1. Create `warehouse_item_catalog` table with catalog-only columns
2. Populate from existing `warehouse_items` (deduplicate by `item_code`, taking the newest)
3. Add `catalog_item_id` FK column to `warehouse_items`, backfill from matching `item_code`
4. Add RLS: SELECT for warehouse/procurement/finance/admin roles; INSERT/UPDATE/DELETE for warehouse/admin
5. Update `remove_item_from_inventory` RPC to work with the separated model

## Code Changes

| File | Change |
|------|--------|
| `src/types/itemBin.ts` | Add `CatalogItem` interface |
| `src/hooks/useWarehouseItemCatalog.ts` | **New** — CRUD hook for `warehouse_item_catalog` |
| `src/hooks/useWarehouseItemsPaged.ts` | Query `warehouse_item_catalog` instead of `warehouse_items` |
| `src/components/warehouse/ItemMasterDefinitionTab.tsx` | Use catalog hook for listing, create, edit, delete |
| `src/components/warehouse/SingleItemForm.tsx` | Catalog mode → insert into `warehouse_item_catalog`; Inventory mode → insert into `warehouse_items` |
| `src/components/warehouse/AddItemsDialog.tsx` | Pass mode to form components |
| `src/components/warehouse/BulkItemImportContent.tsx` | Insert into `warehouse_item_catalog` in catalog mode |
| `src/components/warehouse/AddFromCatalogDialog.tsx` | Query `warehouse_item_catalog` for available items; on import, create `warehouse_items` row with `catalog_item_id` |

## Key Behavior Changes

- **Item Master tab**: Reads/writes `warehouse_item_catalog`. No company scoping. All users see the same global catalog.
- **Inventory tab**: Reads/writes `warehouse_items` (company-scoped, `current_stock > 0` filter). Unchanged from current behavior.
- **Import from Catalog**: Shows ALL active catalog items, excludes those already in the company's inventory (matched by `catalog_item_id`). Creates a `warehouse_items` row with initial stock and bin allocation.
- **Delete from Item Master**: Deletes from `warehouse_item_catalog` (with FK protection if inventory rows reference it).
- **Remove from Inventory**: Unchanged — clears stock/allocations via existing RPC.

