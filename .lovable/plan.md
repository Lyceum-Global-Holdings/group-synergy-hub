
Goal: permanently remove the 1,000-item ceiling in Item Master and switch to true lazy loading (100 items per fetch), so users can browse all 14,000+ items reliably.

What’s still wrong now
- Current implementation uses offset pagination (`.range(from, to)`) plus `count`.
- In some Supabase/PostgREST setups, this still behaves like a capped window at 1,000, so UI totals/pages never go past 1,000.
- Item Master also still mounts `useWarehouseItems()` for mutations, which triggers an unnecessary full-list query in the background.

Implementation plan

1) Replace offset paging with cursor-based lazy loading (keyset pagination)
- File: `src/hooks/useWarehouseItemsPaged.ts`
- Refactor to return batches by cursor, not by page number:
  - Batch size fixed at 100.
  - Order by `created_at DESC, id DESC` (stable deterministic order).
  - For next batch, query with cursor condition:
    - `created_at < last_created_at OR (created_at = last_created_at AND id < last_id)`
- Keep all filters server-side (search/category/status/supplier) so filtering is global across full dataset.
- Return:
  - `items` (current batch)
  - `nextCursor` (null when done)
  - optional `hasMore`
- Why: keyset pagination does not depend on large offsets and is the most reliable way to pass 1,000+ rows progressively.

2) Add true lazy-loader hook API for UI consumption
- Same file (`useWarehouseItemsPaged.ts`) or new hook export:
  - `useWarehouseItemsLazy(...)` using `useInfiniteQuery` (or equivalent controlled query flow).
  - Query key includes active filters/search so filter changes reset loaded results automatically.
  - Expose:
    - `items` (flattened loaded list)
    - `fetchNextPage`
    - `hasNextPage`
    - `isFetchingNextPage`
    - `isLoading`
- Keep query key prefix under `['warehouse-items', ...]` so existing invalidations still refresh correctly.

3) Update Item Master UI to lazy-load 100 at a time
- File: `src/components/warehouse/ItemMasterDefinitionTab.tsx`
- Replace current page-number controls with lazy loading UX:
  - Render loaded items only.
  - Add bottom “Load more (100)” button and optional auto-load sentinel.
  - Show count like: `Loaded X items` (or `Loaded X of Y` if total count endpoint is available).
- Keep debounce + server filters exactly as now.
- Remove dependency on page index/totalPages that can lock UI at 1,000.

4) Stop the hidden legacy 1,000 query in Item Master
- File: `src/hooks/useWarehouseItems.ts`
- Add `disableFetch?: boolean` option and set query `enabled` accordingly.
- File: `src/components/warehouse/ItemMasterDefinitionTab.tsx`
- Call `useWarehouseItems({ skipCompanyFilter: true, disableFetch: true })` for mutations only.
- Why: avoids an unnecessary full-list query and removes confusing side effects/perf cost.

5) Make Excel export use the same cursor strategy (not offset ranges)
- File: `src/hooks/useWarehouseItemsPaged.ts`
- Refactor `fetchAllWarehouseItemsBatched` to cursor loop in 1,000-row chunks:
  - same ordering + cursor logic
  - same filters
  - loop until no `nextCursor`
- Why: guarantees export is complete beyond 1,000 in every environment.

6) Optional hardening for permanent reliability
- Add dedupe-by-id when appending pages (defensive against edge timestamp ties).
- Add fallback secondary count query (`head: true`) only for display; do not block browsing on count value.
- Keep tie-breaker by `id` with `created_at` to avoid missing records with identical timestamps.

Acceptance criteria
- Item Master can load past 1,000 and continue until all available items are reachable.
- Each lazy fetch returns max 100 rows.
- Search/filter operate across the full dataset, not just first 1,000.
- No background legacy full-list fetch is triggered from Item Master.
- Excel export includes all matching rows beyond 1,000.
