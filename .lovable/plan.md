## Goal

Make the Item Master table sortable by clickable column headers, with a default sort of **Name ascending**. Keep the existing infinite-scroll + virtualization model.

## Why server-side sort (not client-only)

The Item Master uses keyset infinite scroll via the `list_warehouse_inventory` RPC, currently ordered by `(created_at DESC, id DESC)`. Sorting only what's already loaded on the client would produce a misleading order (later pages would arrive out of place). Sorting must happen in the RPC so each fetched page is globally ordered.

## Scope (in)

1. **DB migration** — extend `list_warehouse_inventory` with sort parameters and keyset cursor parity for the chosen sort:
   - New params: `_sort_by text DEFAULT 'name'` (allowlist: `name`, `item_code`, `created_at`, `current_stock`), `_sort_dir text DEFAULT 'asc'` (allowlist: `asc`, `desc`).
   - Cursor changes: add `_cursor_name text` and `_cursor_item_code text`, `_cursor_stock numeric` so keyset works per sort key. `id` stays the tie-breaker (memory rule: cursor must be strictly monotonic — never trust `id` alone).
   - ORDER BY built from the allowlisted sort key + `id` tie-breaker, ascending or descending consistently in both the windowing clause and the final SELECT.
   - Filter-before-paginate preserved (memory rule).
   - Keep existing behavior when callers pass no sort (back-compat default becomes `name asc`).

2. **Hook** — `useWarehouseItemsLazyInventory`:
   - Accept `sortBy` and `sortDir` options (default `'name'` / `'asc'`).
   - Include them in the React Query key so changing sort refetches from page 1.
   - Build the cursor payload from the last row's sort key + `id` and pass to the RPC.

3. **UI** — `ItemMasterTab.tsx`:
   - Sortable headers on **Name**, **Item Code**, **Stock**, **Created**. Click toggles asc → desc → asc. Active header shows an arrow (lucide `ArrowUp` / `ArrowDown`, neutral `ArrowUpDown` when inactive).
   - Default state on mount: `{ sortBy: 'name', sortDir: 'asc' }`.
   - Changing sort resets scroll position to top and lets the hook refetch.
   - Keep all existing filters, virtualization, and infinite-scroll trigger logic untouched.

## Scope (out)

- No change to other warehouse tabs, no change to columns, no change to page size, no client-side multi-column sort.
- No change to filters, search, RBAC, or RLS.

## Files to touch

- `supabase/migrations/<new timestamp>_warehouse_inventory_sort.sql` — new RPC version with sort params.
- `src/hooks/useWarehouseItemsLazyInventory.ts` — pass sort + extended cursor.
- `src/components/warehouse/ItemMasterTab.tsx` — sort state, sortable headers, default `name asc`.

## Validation

- On `/warehouse/item-bin-master`: items load alphabetically by Name ascending on first render.
- Click Name header → toggles to descending; click Item Code → switches sort key; arrow indicator follows the active column.
- Infinite scroll continues to append in the new order without duplicates or gaps.
- Existing filters (category, status, supplier, location, stock mode, search) still work in combination with sort.
