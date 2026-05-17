# Revert LNPE to standalone main warehouse

The earlier migration re-parented `LNPE` (`a7d67f4c…`) under "Lyceum Nugegoda Quarters" and switched its operator to NCG. You've decided LNPE must stay a top-level main warehouse, not a sub-location of LNQ.

## Change

One data migration on `warehouse_locations` row `a7d67f4c…` (LNPE):

- `parent_id` → `NULL` (top-level)
- `company_id` → `11a46626-34c8-4ea8-8cc1-df0ec439fd48` (Lyceum Nugegoda — original owner)
- `type` → `'warehouse'`
- `is_standalone_warehouse` → `true`

## What stays as-is

- LNPE bin (`dfce7a5b…`) keeps `is_shared = true`.
- The 143 LNQ-owned allocations and 286 NCG-owned allocations in that bin are untouched — the multi-owner shared-bin pattern continues to handle cross-company visibility.
- No stock movements, no FIFO/batch relinking, no code changes.

## SQL

```sql
UPDATE public.warehouse_locations
   SET parent_id               = NULL,
       company_id              = '11a46626-34c8-4ea8-8cc1-df0ec439fd48',
       type                    = 'warehouse',
       is_standalone_warehouse = true,
       updated_at              = now()
 WHERE id = 'a7d67f4c-7b06-4ce1-904c-a6097c0641a1';
```

## Result

LNPE shows again as its own main warehouse under Lyceum Nugegoda company in the location tree; NCG continues to see its 286 owned allocations through the shared-bin mechanism.
