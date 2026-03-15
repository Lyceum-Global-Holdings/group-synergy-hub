

# Remove Inventory/Stock Operations from Bulk Item Import

## Problem
When items are bulk imported in Item Master, the system currently allows setting initial stock, bin assignments, and creates stock movement records. The user wants bulk import to only create item catalog definitions — inventory will be managed separately.

## Changes

### File: `src/components/warehouse/BulkItemImportContent.tsx`

1. **Remove from CSV template**: Drop `initial_stock` and `bin` columns from the generated template headers.

2. **Remove parsing logic**: Skip the `initial_stock` and `bin` case branches in the CSV parser. Remove the warning about "Initial stock specified but no valid bin provided."

3. **Remove stock operations after insert**: After inserting new items, remove the block that:
   - Creates `warehouse_bin_allocations` entries
   - Updates `warehouse_items.current_stock`
   - Inserts `warehouse_stock_movements` (opening_stock records)
   - Invalidates `warehouse-bin-allocations` query cache

4. **Remove unused imports/hooks**: Remove `useWarehouseLocations`, `useWarehouseBins` if only used for bin lookups in bulk import. Remove `bin_id` and `initial_stock` from the `ParsedItem` interface.

5. **Remove from preview table**: Strip any columns showing initial stock or bin assignment in the pre-import confirmation view.

This keeps bulk import focused purely on catalog definition (item code, name, category, unit, pricing, supplier, etc.) with no side effects on inventory.

