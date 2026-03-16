

# Fix: Items disappearing from Item Master when deleted from Inventory

## Root Cause

Two issues found:

1. **Inventory-only items have no catalog entry**: When items are added directly in the Inventory tab (`mode='inventory'` in `SingleItemForm`), they are inserted only into `warehouse_items` — no corresponding `warehouse_item_catalog` entry is created. These items never appear in Item Master. When removed from inventory (stock zeroed), they vanish from both views entirely.

2. **Pre-migration items share IDs**: The migration copied `warehouse_items.id` as `warehouse_item_catalog.id`, so for migrated items, both tables have the same UUID. The `remove_item_from_inventory` RPC only zeros stock on `warehouse_items` and does not touch `warehouse_item_catalog`, so this path is actually safe. The real problem is path #1.

## Fix

### 1. Inventory item creation must also create a catalog entry
In `SingleItemForm.tsx`, when `mode='inventory'`:
- First insert into `warehouse_item_catalog` (the global definition)
- Then insert into `warehouse_items` with `catalog_item_id` pointing to the new catalog entry
- This ensures every inventory item always has a catalog record

### 2. Backfill orphaned warehouse_items
Create a migration/data fix to insert `warehouse_item_catalog` entries for any `warehouse_items` rows that have `catalog_item_id IS NULL` (items created after the migration without catalog entries).

### 3. Remove the standalone "Add Item" from Inventory tab
Since items should always come from the catalog, the Inventory tab's add-item flow should either:
- Create a catalog entry first (as in fix #1), OR
- Only allow importing from catalog (already supported via `AddFromCatalogDialog`)

I recommend keeping both options but ensuring both paths create a catalog entry.

### Files to change
| File | Change |
|------|--------|
| `src/components/warehouse/SingleItemForm.tsx` | In inventory mode, create catalog entry first, then inventory row with `catalog_item_id` |
| Migration SQL | Backfill: insert into `warehouse_item_catalog` for orphaned `warehouse_items` rows |

