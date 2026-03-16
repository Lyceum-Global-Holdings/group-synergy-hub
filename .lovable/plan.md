

# Fix: Warehouse items capped at 1,000 instead of 20,000

## Problem Summary

The main list tabs (Item Master Definition, Inventory) already use lazy infinite-scroll hooks that work correctly up to 20,000 items. However, many dialogs and the `ItemSelector` component use the **`useWarehouseItems`** hook, which fetches items via a single query with `.limit(20000)`. Supabase's hosted API has a **default max of 1,000 rows per request**, so only 1,000 items are ever returned regardless of the `.limit()` value.

Similarly, `useWarehouseItemCatalog` fetches with no explicit limit, defaulting to Supabase's 1,000-row cap.

## Root Cause

Supabase's PostgREST configuration has a default `max_rows` of 1,000. The `.limit(20000)` call in `useWarehouseItems` (line 35) is silently capped to 1,000 by the server.

## Plan

### 1. Convert `useWarehouseItems` to cursor-based batching (like the existing lazy hooks)

**File: `src/hooks/useWarehouseItems.ts`**

Replace the single query (line 35, `.limit(20000)`) with a batched cursor loop that fetches 1,000 items per batch until all items are loaded (up to 20,000). This matches the pattern already used in `fetchAllWarehouseItemsBatched` in `useWarehouseItemsPaged.ts`.

The hook's external API stays the same (`items`, `isLoading`, mutations). Only the `queryFn` changes internally.

### 2. Convert `useWarehouseItemCatalog` to cursor-based batching

**File: `src/hooks/useWarehouseItemCatalog.ts`**

Same fix: replace the single `.select().order()` query (lines 14-18) with a batched cursor loop fetching 1,000 per batch. This ensures `BulkItemImportContent` and other consumers get all catalog items.

### 3. Keep `ItemSelector` and dialog pickers unchanged (hybrid approach)

Per user preference, the main tabs keep their infinite-scroll lazy loading, and the item pickers in dialogs continue using `useWarehouseItems`. Since step 1 fixes that hook to actually return all items (not just 1,000), the pickers will work correctly without further changes. This is the simplest path that solves the problem.

### 4. Add batching to bin allocations query in `useWarehouseItems`

**File: `src/hooks/useWarehouseItems.ts`**

The allocations query on line 66-69 also has no limit and could be capped at 1,000. Add batching for the `warehouse_bin_allocations` fetch as well.

## Technical Details

### Batched fetch pattern (already proven in the codebase)
```typescript
async function fetchAllBatched(baseQuery, batchSize = 1000) {
  const all = [];
  let cursor = null;
  while (true) {
    let query = baseQuery
      .order('created_at', { ascending: false })
      .order('id', { ascending: false });
    if (cursor) {
      query = query.or(
        `created_at.lt.${cursor.created_at},and(created_at.eq.${cursor.created_at},id.lt.${cursor.id})`
      );
    }
    query = query.limit(batchSize);
    const { data, error } = await query;
    if (error) throw error;
    all.push(...(data || []));
    if (!data || data.length < batchSize) break;
    const last = data[data.length - 1];
    cursor = { created_at: last.created_at, id: last.id };
  }
  return all;
}
```

### Files to modify
1. **`src/hooks/useWarehouseItems.ts`** — Replace single query with batched cursor loop in `queryFn`; also batch the allocations fetch
2. **`src/hooks/useWarehouseItemCatalog.ts`** — Replace single query with batched cursor loop in `queryFn`

### Files NOT modified (already working correctly)
- `useWarehouseItemsLazyInventory.ts` — infinite scroll, works fine
- `useWarehouseItemsPaged.ts` — infinite scroll + batched export, works fine
- `ItemMasterTab.tsx` — uses lazy hook, works fine
- `ItemMasterDefinitionTab.tsx` — uses lazy hook, works fine

### Impact
- All 11+ dialogs using `useWarehouseItems()` will now see up to 20,000 items
- `ItemSelector` component will show all items
- `BulkItemImportContent` duplicate detection will check against full catalog
- No UI changes needed; only internal data-fetching logic changes

