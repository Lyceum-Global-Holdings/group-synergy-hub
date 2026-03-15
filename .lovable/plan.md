

# Add Lazy Loading to Inventory Tab

## Problem
The Inventory tab (`ItemMasterTab`) uses `useWarehouseItems()` which hits the Supabase 1,000-row cap. All filtering is client-side, so only the first 1,000 items are visible.

## Approach
Apply the same cursor-based infinite scroll pattern already working in Item Master Definition tab, but adapted for Inventory's needs (bin data, location stock, etc.).

## Changes

### 1. Create `useWarehouseItemsLazyInventory` hook (new file or extend `useWarehouseItemsPaged.ts`)
- Same cursor-based `useInfiniteQuery` pattern as `useWarehouseItemsLazy`
- Key difference: the select clause includes `*, supplier:suppliers(id, name)` and post-fetches bin allocation data per batch
- Server-side filters: search, categoryId, status, supplierId
- 100 items per page, cursor by `(created_at DESC, id DESC)`
- Bin data fetched per batch (bin allocations + bin codes for each page of item IDs)

### 2. Update `ItemMasterTab.tsx`
- Replace `useWarehouseItems()` with the new lazy hook (keep mutations via `useWarehouseItems({ disableFetch: true })`)
- Move search/category/status/supplier filters to server-side (debounced search)
- Remove client-side `filteredItems` logic for search/category/status/supplier (bin filter stays client-side since it depends on joined data)
- Add `IntersectionObserver` sentinel at bottom of table for auto-loading next 100 items
- Add "Load more" button fallback and "Loaded X items" counter
- Keep all existing dialogs, admin tools, and actions unchanged

### 3. Location stock data
- The `itemLocationStock` query fetches all allocations globally — this stays as-is since it's a separate aggregation query not limited by the items query
- Bin filter remains client-side (applied after lazy-loaded items arrive) since bin assignments come from a separate join

### 4. Excel export
- Use batched cursor fetch (same pattern as Item Master Definition) to export all filtered items, not just currently loaded ones

### Files to modify
- `src/hooks/useWarehouseItemsPaged.ts` — add `useWarehouseItemsLazyInventory` export with bin-enrichment per batch
- `src/components/warehouse/ItemMasterTab.tsx` — switch to lazy hook, add infinite scroll sentinel, server-side filters
- `src/hooks/useWarehouseItems.ts` — already has `disableFetch`, no changes needed

