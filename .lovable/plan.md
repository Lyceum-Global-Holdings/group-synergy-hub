# Speed up Item Master on /warehouse/item-bin-master

## Root cause

The slow screen is `ItemMasterDefinitionTab.tsx`, not the previously-tuned `ItemMasterTab.tsx`. With 14k+ catalog rows it suffers from:

1. **No row virtualization** — every loaded row becomes a real `<tr>` in the DOM. After scrolling 2–3 pages the browser is laying out 200–300 rich rows (image + 8 cells + tooltip + actions) on every state change.
2. **Page size 100** — first paint waits for 100 rows + their images.
3. **O(N×M) lookups in render** — `categories.find(...)` and `units.find(...)` run for every visible row on every render.
4. **Eager `<img>` thumbnails** — 100 network requests fire alongside the first data response.
5. **Blocking count query** — `get_warehouse_catalog_count` runs on every keystroke / filter change, competing with the page fetch.
6. **No server sort control** — RPC orders by `created_at` only; user expects ascending Name like the other tab.

## What we'll change (frontend + 1 small RPC tweak)

### 1. `src/components/warehouse/ItemMasterDefinitionTab.tsx`
- **Virtualize rows** with `@tanstack/react-virtual` (same pattern already used in `ItemMasterTab.tsx`): only render ~50 visible rows regardless of how many pages have loaded. Use a scroll container ref with `max-h-[calc(100vh-320px)] overflow-auto`, `estimateSize: 48`, `overscan: 8`.
- **Drive infinite scroll from the virtualizer** (prefetch next page when last virtual row is within 10 of the end) and remove the IntersectionObserver sentinel.
- **`pageSize = 50`** (matches the inventory tab and user request).
- **O(1) lookup maps**: `categoryById = useMemo(() => new Map(categories.map(c => [c.id, c])))`, same for `unitById`. Replace `.find()` in render with `Map.get()`.
- **Lazy thumbnails**: add `loading="lazy"` and `decoding="async"` to the `<img>` tag.
- **Sortable headers** for Item Code / Name / Status — default `sortBy='name'`, `sortDir='asc'`. Click toggles asc→desc; changing sort resets scroll and refetches from page 1.
- **Defer count**: keep the count query but mark `enabled: items.length > 0` (or simply drop the badge from the critical path) and add `staleTime: 60_000` so it doesn't re-run while typing. The count is currently shown nowhere visible in the header — confirm and remove if unused; otherwise just lazy-enable it.
- **Memoize row renderer** (`renderRow(item, virtualIndex)`) and keep `<TableRow>` props referentially stable so React skips re-rendering unchanged rows during scroll.

### 2. `src/hooks/useWarehouseItemsPaged.ts`
- Default `pageSize` 100 → **50**.
- Accept optional `sortBy` (`'name' | 'item_code' | 'created_at'`) and `sortDir` (`'asc' | 'desc'`); include in `queryKey` and pass to the RPC. Extend the `Cursor` type with `name`.
- Keep `gcTime` long, add `staleTime: 30_000`.

### 3. DB migration — extend `get_warehouse_catalog_page`
- Add allowlisted `p_sort_by` (`name | item_code | created_at`) and `p_sort_dir` (`asc | desc`) params, plus an extra `p_cursor_name` for name-sorted keyset.
- Compose `ORDER BY <sort_key> <dir>, id <dir>` and matching keyset WHERE so pagination stays strictly monotonic (per the project's keyset-uniqueness rule).
- Filter-before-paginate preserved. Defaults stay backward-compatible (`name asc`).
- Ensure supporting index exists: `warehouse_item_catalog(name, id)` and `(item_code, id)` (trigram on `name` already exists per memory).

## Out of scope
- No changes to `ItemMasterTab.tsx`, Bin/Categories/Units tabs, RBAC, RLS, or any mutation paths.
- No change to image storage or CDN; just `loading="lazy"`.
- No new dependencies (`@tanstack/react-virtual` already installed).

## Expected impact
- First paint goes from ~100 hydrated rows + 100 image fetches → ~15 rows + ~15 lazy images.
- Scroll stays smooth past 1k+ rows because the DOM size is bounded.
- Filter / search typing no longer blocked by a parallel `COUNT(*)`.
- Sort is server-side and keyset-stable, so infinite scroll keeps working when sorted by Name.

## Files touched
- `src/components/warehouse/ItemMasterDefinitionTab.tsx` (refactor render + sort UI + virtualization)
- `src/hooks/useWarehouseItemsPaged.ts` (pageSize 50, sort params, cursor)
- `supabase/migrations/<new>_catalog_page_sort.sql` (extend RPC with sort + name cursor)
- `src/integrations/supabase/types.ts` (regenerated after migration)
