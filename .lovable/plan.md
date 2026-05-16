# Inventory module performance refactor

## Why it's slow today

Measured against `src/pages/warehouse/Inventory.tsx` + `ItemMasterTab.tsx` + `StockMovementChart.tsx`:

1. **`StockMovementChart` calls `useWarehouseItems()`** to populate the "All Items" Select. That hook cursor-batches the entire `warehouse_items` table (1,000 rows per round-trip, up to 14k+ rows) and then fetches every bin allocation for every item — just to fill a dropdown the user rarely opens. This violates the existing memory `warehouse-inventory-server-pagination` (RPC + keyset only). Single biggest cause of the slow first paint.
2. **Realtime fan-out** — `useRealtimeStockUpdates` invalidates `["warehouse-items"]` on every bin/allocation change, which re-triggers the full-fetch above whenever any user anywhere edits stock.
3. **O(n·m) lookups in the render loop** — every visible row calls `categories.find(...)`, `units.find(...)`, `companies.find(...)`. With 200+ rows and 100+ categories this is tens of thousands of array scans per render.
4. **Unvirtualized table** — `ItemMasterTab` renders all loaded rows (up to 20,000) into the DOM. Project memory `VirtualTable Pattern` requires `VirtualTable` for lists ≥200 rows.
5. **`useWarehouseLocations()` returns the full hierarchy** even though Inventory only needs the name of the currently-selected location (used in one place: the "no inventory" empty state + per-row location label).
6. **Tooltip-per-bin** — `TooltipProvider` wraps each row's bin badges, mounting Radix portals for thousands of cells.
7. **Filter sentinel for infinite scroll** runs side-by-side with full client-side bin filter (`uniqueBins` recomputed from all loaded items every render); fine for 100 rows, expensive at 5k.

## Target architecture (SAP EWM / Oracle WMS aligned)

- **Server-side pagination only** — every list view uses `list_warehouse_inventory` RPC with keyset cursor (already exists). No hook may full-fetch `warehouse_items` for a list/chart/selector.
- **Lookup caches** — categories/units/companies fetched once, indexed by id in a `Map`, looked up in O(1).
- **Virtualized rendering** — table body uses `VirtualTable` (project standard) so DOM cost is bounded regardless of result size.
- **Async item picker** — any "pick an item" UI uses a debounced server-search RPC (`list_warehouse_inventory` already supports `_search`), not a pre-loaded `<Select>` of every item.
- **Scoped realtime** — invalidate only the inventory-page query key + targeted hooks; don't blow away the global `warehouse-items` cache from the inventory route.

## Changes

### 1. Stock Movement Chart — remove the full-fetch (biggest win)
- **File:** `src/components/warehouse/StockMovementChart.tsx`
- Remove `useWarehouseItems()`.
- Replace the inline `<Select>` of all items with a new `<ItemSearchCombobox>` (see step 2) that searches via `list_warehouse_inventory` RPC, debounced 300 ms, page size 25.
- Default chart view stays "All Items" — only fetch a specific item's series when one is picked.

### 2. New shared async item picker
- **New file:** `src/components/warehouse/ItemSearchCombobox.tsx`
- shadcn `Command` + `Popover`. Calls `list_warehouse_inventory` with `_search`, `_status='active'`, `_limit=25` keyed by debounced query.
- Returns `{ id, item_code, name }`. Reused by StockMovementChart and any future selectors that don't need bulk data.

### 3. Item Master Tab — lookup maps, virtualization, smaller realtime
- **File:** `src/components/warehouse/ItemMasterTab.tsx`
  - Build `categoryById`, `unitById`, `companyById` as `useMemo(() => new Map(...))` and replace every `.find(...)` in the render with `.get(id)`.
  - Replace the `<Table>` body with `VirtualTable` (`src/components/shared/VirtualTable.tsx`) configured with the existing column set. Header/filter bar stays the same; row renderer is extracted to a memoised `<InventoryRow>` component (`React.memo` with stable item key + `selected` flag).
  - Drop the inline `TooltipProvider` per row — mount one `TooltipProvider` at the table root.
  - Remove the unused `queryClient` + `selectedItems` calculation when nothing is selected (cheap, but tidies render).
  - Replace `useWarehouseLocations()` with a lighter `useWarehouseLocationName(globalLocationId)` selector that pulls a single row when needed.
- **File:** `src/hooks/useRealtimeStockUpdates.ts`
  - Replace `scheduleInvalidate(queryClient, ["warehouse-items"])` with `["warehouse-items-inventory"]` (the inventory RPC key) + `["warehouse-bin-allocations", cid]`. Don't trash the bulk `warehouse-items` cache from a stock event.

### 4. Inventory page shell
- **File:** `src/pages/warehouse/Inventory.tsx`
  - Move `<StockMovementChart />` behind an `IntersectionObserver`-gated `<Suspense>` so it only mounts when scrolled into view (it's a 30-day analytics chart, not above-the-fold critical content).
  - Keep `useRealtimeStockUpdates()` at the page level.

### 5. New lightweight location-name hook
- **New file:** `src/hooks/useWarehouseLocationName.ts`
- `useQuery` keyed by `locationId`, selects just `id,name` from `warehouse_locations`. `staleTime: 5 min`. Avoids loading the full tree on the inventory page.

## Out of scope

- No DB schema or RPC changes — `list_warehouse_inventory` already covers what we need.
- No changes to other consumers of `useWarehouseItems` (bulk/import dialogs legitimately need the full list per the existing memory).
- No changes to the relocate bin workflow, RBAC, or stock-mutation paths.

## Acceptance

- Cold load of `/warehouse/inventory` issues exactly one `list_warehouse_inventory` RPC (page 1) + the small lookup queries (categories, units, companies, current-location name). No `warehouse_items` full scan on this route.
- DOM node count on the inventory table stays < ~1,500 regardless of how many pages are scroll-loaded (virtualization).
- Switching company/location does not refetch the entire `warehouse_items` table.
- A bin allocation change in another tab no longer invalidates the global `warehouse-items` cache from the inventory route.
- Stock Movement Chart's item picker stays responsive with 14k+ items because it searches server-side.

## Technical notes

- `VirtualTable` props live in `src/components/shared/VirtualTable.types.ts` — reuse the same column shape used by other warehouse tables (e.g. inventory valuation) for consistency.
- The lookup `Map` pattern must use `useMemo` keyed on the source array reference so React Query cache hits don't rebuild it.
- Async combobox must guard against stale results — track the latest query string in a ref and discard responses whose query no longer matches.
- Keep `staleTime: 30s` (project default) for the new lookups; do not opt them into `staleTime: 0`.
