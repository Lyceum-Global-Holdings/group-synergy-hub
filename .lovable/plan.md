

# Separate Item Master (Catalog) from Inventory Operations

## Problem
1. **Adding items in Item Master Definition** also creates inventory records (initial stock, bin allocations, stock transactions) — but Item Master is a global catalog shared across all companies; inventory should only be created from the Inventory tab.
2. **Deleting items from the Inventory tab** deletes the actual `warehouse_items` row from the database — it should only remove the inventory association (bin allocations, stock) while keeping the catalog entry intact.

## Changes

### 1. `SingleItemForm.tsx` — Add a `mode` prop to control behavior

Pass a `mode: 'catalog' | 'inventory'` prop (default `'inventory'` for backward compatibility).

- **`catalog` mode** (used from Item Master Definition tab):
  - Hide the "Initial Stock" and "Bin Allocation" fields entirely
  - On submit, call `createItemAsync` without `initialStock` / `initialUnitCost`
  - No stock transaction or bin allocation is created
  - This creates a pure catalog definition only

- **`inventory` mode** (used from Inventory tab):
  - Keep current behavior: show initial stock, bin, create transactions and allocations

### 2. `AddItemsDialog.tsx` — Pass `mode` prop through

Add a `mode` prop and forward it to `SingleItemForm` and `BulkItemImportContent`.

### 3. `ItemMasterDefinitionTab.tsx` — Pass `mode="catalog"` to AddItemsDialog

So that adding/editing from the Item Master Definition tab never touches inventory.

### 4. `ItemMasterTab.tsx` — Change delete to remove inventory only

Instead of calling `deleteItem` (which deletes the `warehouse_items` row), the Inventory tab's delete action should:
- Delete `warehouse_bin_allocations` for that item
- Delete `warehouse_stock_transactions` for that item  
- Set `current_stock` to 0 on the item (or optionally set status to `inactive`)
- **Not** delete the `warehouse_items` row itself

This means renaming the delete action to "Remove from Inventory" with a clear confirmation message explaining the item will remain in the catalog.

### Files to modify
- `src/components/warehouse/SingleItemForm.tsx` — add `mode` prop, conditionally hide stock/bin fields and skip stock creation
- `src/components/warehouse/AddItemsDialog.tsx` — add and pass `mode` prop
- `src/components/warehouse/ItemMasterDefinitionTab.tsx` — pass `mode="catalog"`
- `src/components/warehouse/ItemMasterTab.tsx` — replace `deleteItem` with inventory-only removal logic

