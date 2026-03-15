
Root cause
- Item Master still caps at 1,000 because Supabase API max-rows is enforced per request. `.limit(20000)` in `useWarehouseItems` does not bypass that cap.
- Current table pagination (100 rows/page) is only client-side after fetch, so it can only paginate the first 1,000 rows returned.

Best fix (true lazy loading, 100 rows at a time)
1) Add server-side paged query hook for warehouse items
- File: `src/hooks/useWarehouseItems.ts`
- Add a new export (or extend hook options) for paged reads:
  - Inputs: `skipCompanyFilter`, `page`, `pageSize`, `search`, `categoryId`, `status`, `supplierId`
  - Query with `.select(..., { count: 'exact' })`, `.order('created_at', { ascending: false })`, `.range(from, to)`
  - Page size fixed at 100 for Item Master usage
- Keep query keys prefixed with `['warehouse-items', ...]` so existing mutation invalidations refresh paged data automatically.

2) Prevent duplicate 1,000-row fetch from the legacy hook in Item Master
- File: `src/hooks/useWarehouseItems.ts`
- Add `disableFetch` option to existing `useWarehouseItems` so Item Master can still use delete/inactive mutations without triggering the old list query.

3) Convert Item Master table to server-side filtering + pagination
- File: `src/components/warehouse/ItemMasterDefinitionTab.tsx`
- Replace client-side `filteredItems` + `slice(...)` with paged hook data:
  - `currentPage`
  - `pageSize = 100`
  - `totalPages = ceil(totalCount / 100)`
- Reset `currentPage` to 1 whenever search/filter changes.
- Keep current pager UI (first/prev/next/last), but drive it from `totalCount` returned by server.
- Update “Showing X–Y of Z items” to use server totals (not local array length).

4) Make filters server-accurate across all 14,000+
- File: `src/components/warehouse/ItemMasterDefinitionTab.tsx`
- Send search term and selected filters into paged query so results are global, not limited to the currently loaded page.
- Prefer ID-based filters (`category_id`, `supplier_id`) for reliable querying.

5) Keep Excel export complete (not just current 100 rows)
- File: `src/components/warehouse/ItemMasterDefinitionTab.tsx`
- On export action, run a dedicated batched fetch loop with the same active filters (e.g., 1000-row ranges) until all matching rows are collected, then generate the workbook.
- This preserves full export behavior while keeping table view lazy-loaded.

Why this is the best solution
- Guarantees access to all 14,000+ items despite API per-request cap.
- Renders only 100 rows at a time for UI performance.
- Avoids loading huge datasets upfront.
- Keeps CRUD flows and cache invalidation behavior intact.

Acceptance checks
- Item Master displays correct total count (14,000+), not capped at 1,000.
- Page navigation can reach the last page and shows all records.
- Search/filter work across entire dataset, not only current page.
- Table renders max 100 rows per page.
- Create/edit/delete/mark inactive refreshes current page correctly.
- Excel export still includes all matching rows.
