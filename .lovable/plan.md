## Remove single-item Add Item form

The `BulkAddItemsPanel` above already supports adding one row at a time (via "Add row" → ItemSelector + qty), so the legacy single-item "Add Item" block is redundant.

### Change
**`src/components/warehouse/CreateMaterialIssueDialog.tsx`**
- Delete the `<div className="border rounded-lg p-4 space-y-4">…</div>` block (lines ~627–701) containing the "Add Item" heading, ItemSelector, Quantity Required, dual-quantity input, Item Code, UoM, Description, Purpose, and the Add Item button.
- Keep `BulkAddItemsPanel` (above) and the added-items table (below) intact.
- Remove now-unused local state/handlers if they become orphaned: `currentItem`, `setCurrentItem`, `handleItemSelect`, `addItem`. Verify no other references before deletion; if any remain (e.g. reservation flow), leave them.
- Drop now-unused imports (`ItemSelector`, `DualQuantityInput`, `Plus`) only if they have no other usages in the file.

### Out of scope
- Bulk Add panel, reserved-items section, items table, and submit flow remain unchanged.
- No backend / schema changes.
