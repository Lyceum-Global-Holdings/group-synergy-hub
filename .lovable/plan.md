## Problem

On `/warehouse/inventory`, filtering by **Lyceum Fulfilment Centre → VEB** shows only **29 items**, even though there are **221 items with stock allocated to VEB** in the database.

## Root cause

The `list_warehouse_inventory` RPC pre-paginates the `warehouse_items` master table **before** applying the location filter:

```sql
base AS (
  SELECT wi.* FROM warehouse_items wi
  WHERE (_company_id IS NULL OR wi.company_id = _company_id)
    AND (_status IS NULL OR wi.status = _status)
    AND public.can_access_company(wi.company_id)
    AND (cursor predicate)
  ORDER BY wi.created_at DESC, wi.id DESC
  LIMIT GREATEST(_limit, 1) * 8           -- ← grabs only the 400 newest items
)
```

The location-scoped allocation join (`with_stock` / `filtered`) runs **after** this limit. Of the 400 newest items in Lyceum Fulfilment, only 29 happen to have allocations under VEB — so the page returns 29 rows. Because the page is shorter than `pageSize` (50), the frontend keyset stops and never asks for the next page, hiding the remaining ~192 items.

This is the same shape of bug whenever a location filter is narrower than the rolling 400-item window: items appear missing.

```text
warehouse_items (newest 400)        warehouse_bin_allocations @ VEB
       └────────────┬──────────────────────────┘
                    │ intersection only
                    ▼
               29 rows returned   ← UI stops here
```

## Fix

Rewrite `list_warehouse_inventory` so that **when a location scope is requested**, the candidate set is driven by the location's allocations rather than by the global newest-items window. The cursor/pagination is then applied to this narrowed candidate set.

### RPC changes (single migration, replaces the function body only)

1. After computing `scope_arr.has_scope` and `scope_arr.ids`:
   - When `has_scope = true`, build a `candidates` CTE:
     ```sql
     SELECT DISTINCT a.warehouse_item_id AS id
     FROM warehouse_bin_allocations a
     WHERE a.location_id = ANY (scope_arr.ids)
       AND (_company_id IS NULL OR a.company_id = _company_id)
       AND a.allocated_quantity > 0
     UNION
     -- include zero-stock items physically homed at the scope when _stock_mode = 'zero'
     SELECT wi.id
     FROM warehouse_items wi
     WHERE _stock_mode = 'zero'
       AND wi.location_id = ANY (scope_arr.ids)
       AND (_company_id IS NULL OR wi.company_id = _company_id)
     ```
   - When `has_scope = false`, `candidates = SELECT id FROM warehouse_items` (unfiltered).

2. Rewrite `base` to start from `candidates`:
   ```sql
   base AS (
     SELECT wi.<cols>
     FROM warehouse_items wi
     JOIN candidates c ON c.id = wi.id
     WHERE (_company_id IS NULL OR wi.company_id = _company_id)
       AND (_status IS NULL OR wi.status = _status)
       AND public.can_access_company(wi.company_id)
       AND (cursor predicate)
     ORDER BY wi.created_at DESC, wi.id DESC
     LIMIT GREATEST(_limit, 1)        -- exact page size, no *8 fudge
   )
   ```

3. Keep the rest of the pipeline (`joined` → `with_stock` → `filtered`) intact. The `filtered` "drop items with zero allocated when has_scope" guard still holds because `candidates` already enforced it.

4. Keep signature, return columns, `SECURITY DEFINER`, `search_path`, and grants identical so no client / type changes are needed.

### Index support

Add (idempotent) if not present:
```sql
CREATE INDEX IF NOT EXISTS idx_bin_alloc_location_company_qty
  ON warehouse_bin_allocations (location_id, company_id)
  WHERE allocated_quantity > 0;
```
Backs the new `candidates` lookup so VEB-scoped queries stay sub-100 ms.

## Expected result

- VEB under Lyceum Fulfilment Centre shows all **221** items (paged 50 at a time, infinite scroll continues correctly).
- No change for users without a location filter — `candidates` collapses to all items.
- All other location/sub-location filters (Lyceum Nugegoda, Wattala, etc.) similarly stop truncating to the newest-400 window.

## Files touched

- New migration: `supabase/migrations/<ts>_fix_list_warehouse_inventory_location_pagination.sql` — replaces `public.list_warehouse_inventory(...)` body and adds the partial index.

No frontend changes required.
