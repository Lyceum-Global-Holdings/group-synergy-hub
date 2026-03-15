

# Increase Warehouse Items Row Limit to 20,000

## Problem
Supabase defaults to returning a maximum of 1,000 rows per query. The `useWarehouseItems` hook has no explicit `.limit()`, so companies with more than 1,000 items silently lose data.

## Change

**File: `src/hooks/useWarehouseItems.ts` (line 34)**

Add `.limit(20000)` to the main warehouse_items query, changing:
```ts
const { data, error } = await query.order('created_at', { ascending: false });
```
to:
```ts
const { data, error } = await query.order('created_at', { ascending: false }).limit(20000);
```

Also check and apply the same limit to related queries (bin allocations, bulk import fetches) that could hit the 1,000-row cap with large item counts.

