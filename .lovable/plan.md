

# Fix: Supabase 1000-Row Default Limit Preventing All Assets from Loading

## Problem

Supabase enforces a **default maximum of 1000 rows** per query response. Even though the code uses `.limit(10000)`, the server still caps results at 1000. This is why only 1000 assets are visible despite having 4152+ in the database.

## Solution

Replace the single `.limit(10000)` query with a **paginated fetch loop** using `.range()` that fetches all rows in batches of 1000 until no more data remains. This pattern will be applied to the main asset query in `useWarehouseAssets.ts`.

## Changes

### File: `src/hooks/useWarehouseAssets.ts`

**Replace the single query (lines 16-30) with a batch-fetch helper:**

```typescript
queryFn: async () => {
  const allData: WarehouseAsset[] = [];
  const batchSize = 1000;
  let from = 0;
  let keepFetching = true;

  while (keepFetching) {
    let query = supabase
      .from('warehouse_assets')
      .select('*')
      .order('created_at', { ascending: false })
      .range(from, from + batchSize - 1);

    if (companyId) {
      query = query.eq('company_id', companyId);
    }

    const { data, error } = await query;
    if (error) throw error;

    allData.push(...(data as WarehouseAsset[]));

    if (!data || data.length < batchSize) {
      keepFetching = false;
    } else {
      from += batchSize;
    }
  }

  return allData;
}
```

This fetches in chunks of 1000 rows using `.range(from, to)` until fewer than 1000 rows are returned, meaning all data has been retrieved.

### No other files need changes

- The KPI cards already derive counts from `filteredAssets` (client-side), so they will automatically reflect the full dataset.
- Pagination in the table (50 per page) is already implemented, so rendering performance is not affected.
- The count queries using `{ count: 'exact', head: true }` are unaffected since they only return counts, not rows.

## Summary

- One file modified: `src/hooks/useWarehouseAssets.ts`
- Replaces `.limit(10000)` with a batch-fetch loop using `.range()` in increments of 1000
- All 4152+ assets will now load correctly
- No performance impact since the table already paginates at 50 rows per page

