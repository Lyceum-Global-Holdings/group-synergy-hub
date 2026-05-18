## Goal
Item Master already requests 50 rows per page from the server, but after several scroll-loads the DOM holds hundreds–thousands of rich `<tr>` nodes (images, tooltips, badges, per-row buttons), which causes the slowness the user is feeling. Add **row virtualization** so only ~50 rows are ever mounted in the DOM, while keeping the existing 50-row server pages and infinite-scroll behavior. This follows the project's existing `VirtualTable`/TanStack Virtual pattern and matches WAI-ARIA Grid + TanStack Virtual best practices.

## Why virtualization (not classic pagination)
- Server already paginates via `useWarehouseItemsLazyInventory({ pageSize: 50 })` — pages stay at 50 rows.
- Slowness is rendering cost: ~12 columns × heavy cells × N rows. Virtualization caps mounted rows at ~viewport + overscan (≈30–60 rows).
- Matches Core memory: "Lists ≥200 rows use shared VirtualTable; never roll custom virtualizer."

## Approach (no behavior change, only rendering)

### `src/components/warehouse/ItemMasterTab.tsx`

1. **Wrap the table in a fixed-height scroll container** (e.g., `max-h-[70vh] overflow-auto`) used as the virtualizer's scroll element. Keep `overflow-x-auto` for column overflow.
2. **Use `useVirtualizer` from `@tanstack/react-virtual`** (already a project dep via shared `VirtualTable`):
   - `count = filteredItems.length`
   - `estimateSize: () => 56` (current row ~py-1.5 + content)
   - `overscan: 8`
   - `getScrollElement` = the wrapper ref
3. **Render rows using top/bottom spacer `<tr>` pattern** (same technique used by `src/components/shared/VirtualTable.tsx`) so native `<table>` layout, sticky `<thead>`, column widths, and the existing rich cells (photo, bins, per-location stock, action buttons) all keep working untouched.
4. **Apply ARIA Grid semantics**: `role="grid"`, `aria-rowcount={filteredItems.length}`, and `aria-rowindex` on each rendered row, so screen readers announce "row N of total" even though only ~50 rows are mounted.
5. **Replace the IntersectionObserver sentinel** with a virtualizer-driven trigger: in a `useEffect`, look at `rowVirtualizer.getVirtualItems()`; when the last virtual row's index is within 10 of `filteredItems.length - 1` and `hasNextPage && !isFetchingNextPage`, call `fetchNextPage()`. This is the TanStack-recommended way to combine `useInfiniteQuery` + `useVirtualizer`.
6. **Keep all other state, filters, dialogs, mutations, selection, columns, and the 50-per-page server cap unchanged.** No hook/API/RPC changes.

### Threshold guard
- Use a small `virtualizeFromRowCount = 100` short-circuit: if fewer than 100 rows are loaded, render the table the existing non-virtual way (zero virtualization overhead for small datasets). Above that, switch to virtualized rows.

## Out of scope
- No DB, RPC, or `useWarehouseItemsLazyInventory` changes.
- No change to page size (stays at 50) or to filters/search/columns.
- No conversion to classic numbered pagination.
- No refactor of `BinAllocationsTab` or other warehouse tabs in this pass.

## Validation
- Verify on `/warehouse/item-bin-master` after edit: scroll through inventory, confirm rows render smoothly, infinite-scroll still appends the next 50, selection/edit/delete/stock-adjustment dialogs still open, sticky header stays, and DevTools shows only ~30–60 `<tr>` nodes in the table body regardless of total loaded.
