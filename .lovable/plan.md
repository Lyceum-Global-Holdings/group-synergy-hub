

# Add Pagination to Item Master Table

## Problem
The table renders all items at once, which is slow for large datasets. The DB query already fetches up to 20,000 rows, but the UI needs to paginate the display.

## Approach: Client-side pagination (100 items per page)

All items are already fetched into memory (needed for filters, search, Excel export). The bottleneck is DOM rendering, so client-side pagination with 100 items per page is the right solution.

### Changes in `src/components/warehouse/ItemMasterDefinitionTab.tsx`

1. **Add pagination state**: `currentPage` (default 1), reset to 1 whenever `filteredItems` changes (search/filter change).

2. **Slice filtered items for display**: 
   - `const pageSize = 100`
   - `const totalPages = Math.ceil(filteredItems.length / pageSize)`
   - `const paginatedItems = filteredItems.slice((currentPage - 1) * pageSize, currentPage * pageSize)`

3. **Render `paginatedItems`** instead of `filteredItems` in the table body.

4. **Add pagination controls** below the table (replacing the current "Showing X of Y" text):
   - Previous / Next buttons
   - Page number display: "Page 1 of 12"
   - Updated count: "Showing 1-100 of 1,200 items"
   - Jump to first/last page buttons for large datasets

5. **Reset page to 1** when search term or any filter changes (via `useEffect` on those dependencies).

No changes to the hook or DB query needed — the 20,000 limit stays as-is.

