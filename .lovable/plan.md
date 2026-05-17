## What's happening

The Inventory tab calls the `list_warehouse_inventory` RPC. Postgres logs show this query is hitting the **statement timeout** repeatedly (dozens of `canceling statement due to statement timeout` errors in the last hour). When the RPC times out, the page silently shows no stock and no bins, even though the data is correct in the database (verified: 1,380 bin allocations exist with matching `(item, bin, location, company)` and `warehouse_items.current_stock` is in sync via the existing trigger).

## Root cause

The current RPC builds one big un-paginated CTE called `scoped_alloc_full` that scans **all** bin allocations for the company, joins to `warehouse_bins`, aggregates, and is then referenced **twice** — once to compute `item_stock`, and again as a correlated subquery for each row's `bins` jsonb. With ~14,800 inventory rows and ~1,400 allocations the planner ends up doing a hash aggregate on the full allocation set on every page request, and the bins subquery re-scans `scoped_alloc_full` per row. This blows past the 8-second statement timeout.

## The fix

Rewrite `list_warehouse_inventory` so the **base item page is selected first** (with cursor + filters → at most `_limit` rows), and stock totals + the `bins` jsonb are computed by joining against just those item ids via a `LATERAL` subquery. The existing indexes (`idx_warehouse_bin_alloc_item`, `idx_warehouse_bin_allocations_company_location_item_positive`) make per-item lookup an index scan.

Shape:

```text
WITH RECURSIVE scope AS (...)            -- recursive child locations (only when caller passes _location_ids)
, base AS (
    SELECT wi.*, cat.* AS m_*
    FROM warehouse_items wi
    JOIN warehouse_item_catalog cat ON cat.id = wi.catalog_item_id
    WHERE <company / category / status / search / cursor filters>
    ORDER BY wi.created_at DESC, wi.id DESC
    LIMIT _limit
)
SELECT b.*, COALESCE(s.allocated_qty, 0) AS current_stock,
       COALESCE(s.available_qty, 0) AS available_quantity,
       COALESCE(s.reserved_qty,  0) AS reserved_quantity,
       COALESCE(bn.bins, '[]'::jsonb) AS bins
FROM base b
LEFT JOIN LATERAL (
  SELECT SUM(a.allocated_quantity) AS allocated_qty,
         SUM(a.available_quantity) AS available_qty,
         SUM(a.reserved_quantity)  AS reserved_qty
  FROM warehouse_bin_allocations a
  JOIN warehouse_bins wb ON wb.id = a.bin_id
  WHERE a.warehouse_item_id = b.id
    AND (_company_id IS NULL OR a.company_id = _company_id)
    AND (_location_ids IS NULL OR wb.location_id IN (SELECT location_id FROM scope))
) s ON TRUE
LEFT JOIN LATERAL (
  SELECT jsonb_agg(jsonb_build_object(...)) AS bins
  FROM warehouse_bin_allocations a
  JOIN warehouse_bins wb ON wb.id = a.bin_id
  LEFT JOIN warehouse_locations wl ON wl.id = wb.location_id
  WHERE a.warehouse_item_id = b.id
    AND a.allocated_quantity > 0
    AND (_company_id IS NULL OR a.company_id = _company_id)
    AND (_location_ids IS NULL OR wb.location_id IN (SELECT location_id FROM scope))
) bn ON TRUE
...
```

Key correctness rules preserved:
- When no `_location_ids` is passed (admin / view-all-locations), totals come from the live bin allocations sum (not `wi.current_stock`), so the data shown matches what `BinAllocations` / `StockTransfer` etc. see. With LATERAL + index lookup this is cheap even on the full company.
- When `_location_ids` is passed, scope expands to children via the recursive CTE and the lateral joins filter on `wb.location_id IN scope` — same semantics as before.
- `_stock_mode` (`all`, `in_stock`, `zero`, `low`) is applied as an outer `WHERE` on the lateral result instead of inside the base CTE.
- Search, category, supplier, status, cursor pagination unchanged.

## Steps

1. Migration: `CREATE OR REPLACE FUNCTION public.list_warehouse_inventory(...)` with the rewritten body above. Grant execute to `authenticated, anon, service_role` (matches current ACL).
2. Smoke-test with `EXPLAIN ANALYZE` for: (a) admin with `_company_id` only, (b) caller with `_location_ids` set, (c) `_stock_mode = 'in_stock'`. Confirm runtime < 500 ms on the current dataset.
3. No frontend changes needed — `useWarehouseItemsLazyInventory` / `useWarehouseInventoryPage` already consume the same return shape.

## Out of scope

- Bulk catalog import flow (already works — allocations are being created correctly).
- RLS policies (unchanged).
- `warehouse_items.current_stock` mirror trigger (kept as-is for other consumers).
