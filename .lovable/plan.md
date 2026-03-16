

# Fix: Import from Catalog dialog only loads 1,000 of 14,648 catalog items

## Root Cause

The `AddFromCatalogDialog.tsx` has two queries that are NOT using the cursor-based batching we added to the hooks. They are standalone inline queries that hit the 1,000-row Supabase limit:

1. **Catalog fetch** (line 38-50): `supabase.from('warehouse_item_catalog').select('*').eq('status', 'active').order('name')` — returns only 1,000 of 14,648 items.
2. **Exclusion fetch** (line 53-65): `supabase.from('warehouse_items').select('catalog_item_id').eq('company_id', ...).gt('current_stock', 0)` — could also be truncated if >1,000 items have stock.

The removed item simply isn't in the first 1,000 catalog rows returned, so it never appears in the dialog.

## Plan

### Update `src/components/warehouse/AddFromCatalogDialog.tsx`

1. Add a batched fetch helper (reusable within the file or imported) that fetches in 1,000-row chunks using cursor-based pagination with `id` as the cursor (since catalog is ordered by `name`, we need a stable cursor — use range-based `id` pagination).

2. **Catalog query**: Replace the single query with the batched loop. Order by `name` for display but use `id > cursor` for pagination.

3. **Exclusion query**: Replace with batched loop fetching all `catalog_item_id` values where `current_stock > 0`.

4. Keep the existing client-side search filtering and UI unchanged.

### Technical approach

For the catalog fetch:
```
let all = [], lastId = null;
while (true) {
  let q = supabase.from('warehouse_item_catalog').select('*').eq('status','active').order('id').limit(1000);
  if (lastId) q = q.gt('id', lastId);
  const { data } = await q;
  all.push(...data);
  if (data.length < 1000) break;
  lastId = data[data.length - 1].id;
}
// Sort by name client-side for display
all.sort((a,b) => a.name.localeCompare(b.name));
```

Same pattern for the exclusion query (though it's less likely to exceed 1,000 active-stock rows, it should be safe).

### Files to modify
- `src/components/warehouse/AddFromCatalogDialog.tsx` — both inline queries

