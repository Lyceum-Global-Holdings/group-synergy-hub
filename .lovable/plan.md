

## Fix: Preview list not scrollable in Bulk Stock Upload dialog

**Problem**: The preview table inside `ScrollArea` doesn't scroll. The `DialogContent` has `max-h-[90vh] flex flex-col` and the `ScrollArea` has `max-h-[400px]`, but the content overflows without enabling scroll.

**Root cause**: The `ScrollArea` needs `overflow-hidden` on its container and the `DialogContent` needs to properly constrain the flex child. The `max-h-[400px]` on `ScrollArea` should work, but the parent `div` with `overflow-hidden` may be clipping without allowing ScrollArea to activate.

**Fix in `src/components/warehouse/BulkStockUploadDialog.tsx`**:

1. **Line 518**: Change ScrollArea to use `h-[400px]` instead of `max-h-[400px]` — ScrollArea requires a definite height to enable scrolling, not just a max-height.
2. Ensure the parent container properly constrains — the current `flex-1 overflow-hidden flex flex-col` on line 498 is fine.

Single line change in one file.

