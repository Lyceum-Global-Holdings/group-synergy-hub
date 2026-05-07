# Warehouse Module Performance Fix

## Why it's slow today (measured)

Opening `/warehouse/item-bin-master` triggers, on every mount:

1. **`useWarehouseItems` fetches all 14,842 rows of `warehouse_items`** in ~15 sequential 1,000-row round-trips (cursor pagination), each with a nested `suppliers` join. `staleTime: 0` + `refetchOnMount: 'always'` means cache never helps.
2. Immediately followed by **a full sweep of `warehouse_bin_allocations`** (1,490 rows) and all `warehouse_bins`, then a client-side join.
3. The result (14k+ rows) is rendered into a **non-virtualized `<Table>`** in `ItemMasterTab.tsx` (1,060 LOC), violating the project's own VirtualTable rule (≥200 rows).
4. `ItemBinMaster.tsx` eagerly imports **all 7 tabs and ~30 dialogs**, so the initial JS chunk for the page is huge — every dialog (bulk import, QR print preview, stock movement chart, etc.) ships before first paint.
5. `ItemMasterDefinitionTab` (the default tab) runs its own catalog fetch in parallel with the inventory hook because both are mounted under `<Tabs>`.
6. `useRealtimeStockUpdates` is mounted at the page level and invalidates these heavy queries on every realtime event.

The combined effect on a cold load is 15+ serial round-trips totalling several MB of JSON, plus a multi-megabyte JS bundle, before the first row paints.

## Goal

First contentful render of the active tab in **< 1.5s on a warm cache, < 3s cold**, with steady-state interactions (search, paging, tab switch) under **300 ms**.

## Approach (aligned to project standards)

This follows the existing project rules already in memory:
- **List RPC pattern** — hot lists use SECURITY INVOKER RPCs returning flat rows, not PostgREST embeds.
- **VirtualTable pattern** — lists ≥200 rows must use the shared `VirtualTable`.
- **Keyset cursor uniqueness** — cursors use `(created_at, id)` tuples.
- **Tiered React Query freshness** — only stock-critical queries opt into `staleTime: 0`; list browsing uses the 30s default.
- **DB index strategy** — `(company_id, created_at DESC)` composite indexes on hot lists.

## Plan

### 1. Database: server-side pagination + search RPC

Add a SECURITY INVOKER RPC `list_warehouse_inventory(...)` that returns one flat page (default 50 rows) joined with supplier name, category, unit, and an aggregated `bin_summary` JSON. This replaces the current "fetch everything then join client-side" pattern.

```text
list_warehouse_inventory(
  _company_id uuid,           -- null = all-companies admin view
  _search text,               -- ILIKE on name/item_code/sku, sanitized
  _category_id uuid,
  _location_ids uuid[],       -- restricts allocations + bins by user permissions
  _status text,
  _cursor_created_at timestamptz,
  _cursor_id uuid,
  _limit int default 50
) returns table (... row_count_estimate bigint)
```

Indexes to confirm/add (idempotent migration):
- `warehouse_items (company_id, created_at DESC, id DESC)`
- `warehouse_items (lower(name) text_pattern_ops)` and `(item_code text_pattern_ops)` for search
- `warehouse_bin_allocations (warehouse_item_id) include (bin_id, available_quantity)`
- `warehouse_bins (location_id)` (verify exists)

A second RPC `warehouse_inventory_counts(_company_id, _filters jsonb)` returns header counts (total, low-stock, zero-stock) so the UI doesn't need the full list to show KPI tiles.

### 2. Frontend: replace the page-level data hook

- Replace `useWarehouseItems()` usage in `ItemMasterTab` with a new `useWarehouseInventoryPage({ search, categoryId, status, pageSize: 50 })` built on `useInfiniteQuery` calling the new RPC. Default `staleTime: 30_000` (project default); realtime invalidation continues to work via `useRealtimeStockUpdates` which already debounces.
- Keep `useWarehouseItems` (full-fetch) only for selectors and bulk operations that genuinely need the whole dataset; mark it with `enabled: false` by default and opt-in per call site.
- Wire the inventory table to the shared `VirtualTable` so even 14k+ rows render in O(viewport).
- Move search/filter to **server-side** (debounced 300 ms input → RPC call), so the client never holds 14k rows.

### 3. Code-splitting inside the page

`ItemBinMaster.tsx`:
- Convert each tab body to `React.lazy()` (`ItemMasterTab`, `BinMasterTab`, `BinAllocationsTab`, `ItemCategoriesTab`, `ItemUnitsTab`, `StockAuditTab`, `ItemMasterDefinitionTab`) and render only the active tab. This stops mounting (and fetching for) all 7 tabs at once and shrinks the initial chunk.
- Wrap each lazy tab in `Suspense` with a lightweight skeleton matching the table layout.

`ItemMasterTab.tsx`:
- Convert the ~25 dialogs (`BulkItemImportDialog`, `BulkStockUploadDialog`, `BulkQRCodeDialog`, `StockMovementReportDialog`, `FixMissingOpeningStockDialog`, `ItemTransferDialog`, etc.) to `React.lazy` and only render them when `open === true`. Today they're all in the initial chunk.
- Drop the unused-on-first-paint `StockMovementChart` from the eager import set; lazy-load on demand.

### 4. Defer non-critical work on the active tab

- `useRealtimeStockUpdates` is fine to keep at the page level, but ensure it is a no-op until the user has been idle on the page for >500 ms (already debounced per memory note — verify and tighten).
- `ItemMasterDefinitionTab` (catalog) currently runs a full catalog fetch even when not visible. After the lazy-tab change above this disappears automatically.

### 5. Cache hygiene

- Switch `useWarehouseItems` (the full-fetch variant kept for selectors) from `staleTime: 0 / refetchOnMount: 'always'` to `staleTime: 30_000`. Stock-critical screens (Material Issue, GRN, Stock Adjustment) already have their own `staleTime: 0` hooks per project rule — they are not affected.
- Add `placeholderData: keepPreviousData` to the paged query so paging/search doesn't blank the table.

### 6. Memory updates

After build:
- Add `mem://performance/warehouse-inventory-server-pagination` — Inventory tab uses `list_warehouse_inventory` RPC + VirtualTable; never client-fetch the full table.
- Update Core: "Warehouse Inventory tab is server-paginated; no full-table client fetches."

## Acceptance criteria

1. Cold load of `/warehouse/item-bin-master` issues ≤ 2 network requests for the active tab's first paint (RPC page + counts).
2. Inventory tab paints first 50 rows in < 1.5 s on a warm cache.
3. Switching to another tab fetches that tab's data only on activation.
4. Bundle: initial chunk for `ItemBinMaster` route shrinks measurably (target ≥ 50% reduction); confirmed via `vite build` output.
5. Search and filter happen server-side; typing in the search box does not freeze the UI.
6. No regression in stock-critical screens (Material Issue, GRN, Adjustment) — they keep their existing `staleTime: 0` hooks.
7. Supabase linter shows no new RLS issues; the new RPC is SECURITY INVOKER and respects existing RLS.

## Out of scope

- Other warehouse pages (Putaway, GRN, etc.) — same pattern can be applied later if they show similar issues, but this plan addresses the page the user is on.
- Migrating bin/allocation tabs to RPCs (their row counts are small enough today).
- Visual redesign.

Reply "go" to switch to build mode and execute: migration first (for your approval), then the hook + lazy-loading refactor in one pass.