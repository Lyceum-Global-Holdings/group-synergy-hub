## Root cause recap

Three independent gaps combined into one user-visible bug ("transferred stock not appearing in LNQ"):

1. **No realtime on bin tables** — `warehouse_bin_allocations` / `warehouse_bins` were not in the `supabase_realtime` publication, so the inventory grid never refetched after a transfer.
2. **No explicit cache invalidation** in transfer dialogs (`MoveBinAllocationDialog`, `ItemTransferDialog`, stock-transfer completion) for the inventory list keys (`warehouse-items-inventory`, `all-items-location-stock`).
3. **Filter-after-paginate bug** in `list_warehouse_inventory` RPC — search/category/location filters ran after `LIMIT`, hiding rows that existed.

All three are now patched, but the same class of bug will recur unless we add structural guardrails.

## Prevention plan

### 1. Realtime publication contract (DB)

- Add a migration that creates a **`verify_realtime_coverage()`** SQL function listing every table the app considers "live" (whitelist) and asserting each is in `supabase_realtime` with `REPLICA IDENTITY FULL`.
- Whitelist seed: all `warehouse_*` movement tables (`warehouse_items`, `warehouse_bin_allocations`, `warehouse_bins`, `warehouse_item_catalog`, `stock_transactions`, `stock_transfer_requests`, `warehouse_locations`).
- Add a pg_cron daily job that calls it and writes failures to `system_errors` so we get alerted before a user does.

### 2. Centralised invalidation helper (frontend)

Create `src/hooks/useInvalidateWarehouseStock.ts` exporting one function that invalidates the full canonical set in one call:

```
['warehouse-items'], ['warehouse-items-inventory'],
['warehouse-bin-allocations'], ['all-items-location-stock'],
['stock-transactions'], ['stock-transfer-requests'],
['warehouse-catalog'], ['warehouse-locations-stock']
```

Then refactor every stock-mutating surface to call **only** this hook:
- `MoveBinAllocationDialog`
- `ItemTransferDialog`
- `CreateStockTransferDialog` + transfer approval/completion flows
- `BulkStockUpload`, GRN allocation, adjustment dialogs, scanned-bin adjustment

Removes the "I forgot to invalidate key X" failure mode forever.

### 3. RPC contract test for `list_warehouse_inventory`

Add a Deno test under `supabase/functions/_tests/` (or a SQL test migration) that seeds:
- 1 company, 2 locations, 50 items, 1 item only at location B with a search-unique name

…and asserts:
- `list_warehouse_inventory(search=>'unique')` returns the row even with default `LIMIT 25` and `OFFSET 0`.
- Same with `location_id` filter.
- Same with `category_id` filter.

This locks in the "filter-before-paginate" contract so a future RPC refactor cannot regress it.

### 4. Realtime listener audit

One-time sweep of `useRealtimeChannel` subscribers to confirm every warehouse list page subscribes to **both** `warehouse_items` and `warehouse_bin_allocations` (today most subscribe only to the former). Codify via a lint-style check: a `// @realtime: warehouse-stock` tag near each subscription, plus a CI grep that fails if a hook named `useWarehouse*Stock*` does not contain the tag.

### 5. Post-mutation read-after-write probe (defence in depth)

In the transfer success handlers, after invalidation, fire a lightweight RPC `verify_bin_allocation(item_id, location_id, bin_id, expected_qty)` and surface a toast warning if the read-back disagrees. Catches DB-side regressions (triggers, ledger drift) at the moment they happen instead of days later.

### 6. Documentation / memory

Add two project-memory entries:
- `mem://architecture/warehouse-realtime-coverage` — canonical list of "live" tables + the invalidation hook to use.
- `mem://architecture/list-rpc-filter-before-paginate` — rule: every list RPC must apply search/scoping filters inside the same CTE that produces the page, never on a pre-paginated subquery.

## Out of scope

- No business-logic changes to transfers, ledger, or FIFO.
- No UI redesign.
- No new tables.

## Deliverables

```
supabase/migrations/<ts>_realtime_coverage_guard.sql
supabase/migrations/<ts>_list_warehouse_inventory_contract_test.sql
src/hooks/useInvalidateWarehouseStock.ts
src/components/warehouse/MoveBinAllocationDialog.tsx        (refactor)
src/components/warehouse/ItemTransferDialog.tsx             (refactor)
src/components/warehouse/CreateStockTransferDialog.tsx      (refactor)
src/components/warehouse/StockTransferDetailsDialog.tsx     (refactor)
mem://architecture/warehouse-realtime-coverage
mem://architecture/list-rpc-filter-before-paginate
```
