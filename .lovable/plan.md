

## Bulk Update & Delete for Inventory Items

### Overview
Add multi-select checkboxes to the Item Master inventory table, with a floating action bar that appears when items are selected, offering bulk **delete** (remove from inventory) and bulk **update** (change category, status, unit, or bin) operations.

### Design

**Selection UI**:
- Add a checkbox column as the first column in the table
- Header checkbox for select-all (visible items)
- Floating action bar appears at bottom of screen when ≥1 item selected, showing count + action buttons

**Bulk Delete**:
- Confirmation dialog showing count of items to be deleted
- Items with stock > 0 get "mark inactive" treatment; zero-stock items get hard-deleted
- Uses existing `deleteItem` / `markItemInactive` mutations in a loop with batch error handling

**Bulk Update**:
- Dialog with optional fields: Category, Unit, Status, Brand, Supplier
- Only non-empty fields get applied — leave blank to skip
- Single Supabase update call per item (batched)

### Implementation — Single file: `src/components/warehouse/ItemMasterTab.tsx`

**1. State additions**:
- `selectedItemIds: Set<string>` for tracking selected rows
- `isBulkUpdateOpen: boolean` and `isBulkDeleteOpen: boolean` for dialogs

**2. Table changes**:
- Add checkbox `<TableHead>` + `<TableCell>` as first column
- Header checkbox toggles all visible `filteredItems`
- Row checkbox toggles individual item

**3. Floating action bar** (rendered when `selectedItemIds.size > 0`):
- Fixed bar at bottom: "{N} items selected" + "Bulk Update" + "Bulk Delete" + "Clear Selection"

**4. New component: `BulkInventoryUpdateDialog.tsx`**:
- Dialog with dropdowns for Category, Status, Unit, Brand (all optional)
- On submit: loops through selected IDs, updates each via Supabase, invalidates queries
- Shows progress and results summary

**5. New component: `BulkInventoryDeleteDialog.tsx`**:
- Confirmation dialog listing selected count
- Separates items into "has stock" (mark inactive) vs "zero stock" (delete)
- Processes deletions using existing hooks, shows summary

### Technical Details

- Selection state resets on filter/search changes and after bulk operations complete
- Bulk update uses `supabase.from('warehouse_items').update({...}).eq('id', id)` per item
- Bulk delete reuses `deleteItem(id, true)` and `markItemInactive(id)` from `useWarehouseItems`
- Query cache invalidated once after all operations complete
- Select-all only selects currently loaded/visible items (not all pages)

### Files
- **Modified**: `src/components/warehouse/ItemMasterTab.tsx` — selection state, checkbox column, floating bar, dialog triggers
- **New**: `src/components/warehouse/BulkInventoryUpdateDialog.tsx` — bulk update dialog
- **New**: `src/components/warehouse/BulkInventoryDeleteDialog.tsx` — bulk delete confirmation dialog

