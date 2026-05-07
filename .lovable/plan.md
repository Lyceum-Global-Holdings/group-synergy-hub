# Lazy-load Warehouse Dialogs (Code-Splitting)

## Goal
Defer the ~13 dialog component chunks in `ItemMasterTab` and the ~3 in `ItemMasterDefinitionTab` until the user actually opens a modal. The Warehouse page chunk currently pulls every dialog (form libs, ExcelJS, chart libs, etc.) eagerly through static imports — this is the largest remaining initial-bundle cost after the Phase 1 work.

## Approach
Convert each dialog import to `React.lazy(...)`, wrap each modal usage in `<Suspense fallback={null}>`, and only render the lazy element while its `open` flag (or trigger state) is truthy. Dialogs already have an `open` boolean, so guarded rendering is a one-line change per dialog and avoids prefetching anything until the user clicks the trigger.

## Changes

### 1. `src/components/warehouse/ItemMasterTab.tsx`
Replace static imports with lazy ones:
- `AddItemsDialog`
- `StockMovementDialog`
- `StockAdjustmentDialog`
- `DeleteItemConfirmationDialog`
- `ItemDetailsDialog`
- `ItemTransferDialog`
- `ItemStockDetailsDialog`
- `FixMissingOpeningStockDialog`
- `StockMovementReportDialog`
- `AddFromCatalogDialog`
- `BulkStockUploadDialog`
- `BulkInventoryUpdateDialog`
- `BulkInventoryDeleteDialog`

For each dialog at lines ~902–1057, wrap in `<Suspense fallback={null}>` and gate render on its `open`/state flag (e.g. `{isCreateDialogOpen || editingItem ? <Suspense>...</Suspense> : null}`). Keep the inline `<Dialog>` image-preview as-is (already gated, no heavy code).

### 2. `src/components/warehouse/ItemMasterDefinitionTab.tsx`
Lazy-load:
- `AddItemsDialog`
- `StockMovementDialog`
- `DeleteItemConfirmationDialog`
- `StockMovementChart` (only used inside a dialog/section)

Wrap usages in `<Suspense fallback={null}>` gated by their open state.

### 3. Shared helper
Add a small inline helper at the top of each file:
```ts
const lazyDialog = <T,>(loader: () => Promise<{ [k: string]: T }>, name: string) =>
  lazy(() => loader().then(m => ({ default: (m as any)[name] })));
```
Optional — direct `lazy(() => import(...).then(m => ({ default: m.X })))` is fine too.

## Acceptance Criteria
- Initial render of `/warehouse/item-bin-master` does not network-fetch dialog chunks until a trigger is clicked (verify in DevTools Network → JS).
- Opening each dialog still works with no visible regression (brief no-op suspense fallback acceptable).
- No TypeScript errors; existing props/handlers unchanged.
- Bundle analyzer shows the warehouse route chunk reduced (each dialog becomes its own chunk).

## Out of Scope
- Other tabs (`BinMasterTab`, `BinAllocationsTab`, etc.) — already lazy at the page level.
- Refactoring dialog internals or data hooks.
- Server-side or RPC changes.
