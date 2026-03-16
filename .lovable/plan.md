

# Fix: Multiple unbatched queries hitting the 1,000-row Supabase limit

## Problem

Several queries across the codebase still use single Supabase `.select()` calls without pagination, silently capping results at 1,000 rows. The main offenders are:

### 1. `useStockAudit.ts` (line 39-48)
The warehouse items fetch for stock audit has **no batching**:
```
supabase.from('warehouse_items').select('id, item_code, name, current_stock').eq('status', 'active')
```
Returns only 1,000 items. The allocation fetch (line 60-71) uses chunking by item ID but each chunk can also hit the 1,000 limit per chunk.

### 2. `ItemMasterTab.tsx` (line 214-217) — `all-items-location-stock` query
```
supabase.from('warehouse_bin_allocations').select('...').gt('available_quantity', 0)
```
No batching — caps at 1,000 allocations. The subsequent bins and locations queries (lines 225-239) also unbatched.

### 3. `useStockMovementReport.ts` (line 82-97)
```
supabase.from('warehouse_items').select('...').in('id', itemIds)
```
If `itemIds` exceeds ~1,000, this will be truncated.

## Plan

### File: `src/hooks/useStockAudit.ts`
- **Items fetch (line 39-48)**: Add cursor-based batching loop (same pattern as `useWarehouseItems.ts`) using `id` cursor, fetching 1,000 rows per batch.
- **Allocations fetch (line 60-71)**: Each chunk's allocation query can also exceed 1,000 rows. Add an inner batching loop per chunk, or better yet, switch to the same ID-cursor approach for allocations globally rather than per-chunk.

### File: `src/components/warehouse/ItemMasterTab.tsx`
- **`all-items-location-stock` query (line 214-217)**: Add cursor-based batching for `warehouse_bin_allocations`.
- **Bins query (line 225-228)**: The `.in('id', binIds)` call could exceed 1,000. Batch in chunks of 500 IDs.

### File: `src/hooks/useStockMovementReport.ts`
- **Items query (line 82-97)**: Batch the `.in('id', itemIds)` call in chunks of 500.

### Batching pattern (reused everywhere)
```typescript
// ID-cursor batching
const allRows = [];
let lastId = null;
while (true) {
  let q = supabase.from('table').select('...').order('id').limit(1000);
  if (lastId) q = q.gt('id', lastId);
  const { data } = await q;
  allRows.push(...(data || []));
  if (!data || data.length < 1000) break;
  lastId = data[data.length - 1].id;
}
```

### Files to modify
- `src/hooks/useStockAudit.ts` — batch items fetch + allocations fetch
- `src/components/warehouse/ItemMasterTab.tsx` — batch `all-items-location-stock` allocations + bins
- `src/hooks/useStockMovementReport.ts` — batch items `.in()` query

