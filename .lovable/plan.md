## Diagnosis

I traced the transfer end-to-end in the database. The stock **was** moved correctly. The UI is showing stale data.

### What the DB shows for `LED ceiling recessed - 8W` (item id `6ceac60f…`)

```text
Transfer:  STR-20260517-001   status=completed   completed at 11:05:44 UTC
           LNPE (dfce7a5b…)  →  LNQ (013c1ade…)   qty 153

warehouse_bin_allocations (per-bin balances):
  LNQ   153.00   ← NEW row, location_id = Lyceum Nugegoda Quarters ✓
  LNPE  245.00   ← decreased from 398 by 153 ✓

stock_transactions (ledger):
  11:05:43  transfer_out  bin=LNPE  qty -153   398 → 245 ✓
  11:05:43  transfer_in   bin=LNQ   qty +153     0 → 153 ✓

warehouse_items.current_stock = 398 (unchanged, transfer is intra-company)
```

Allocation row, ledger, and stock totals are all consistent. The 153 units are physically in LNQ as a brand-new bin allocation. **There is no DB bug.**

### Why the Inventory UI doesn't show LNQ

The Inventory tab reads from `list_warehouse_inventory` and is refreshed by `useRealtimeStockUpdates`, which subscribes to `warehouse_bin_allocations` and `warehouse_bins` Postgres CDC events.

The Supabase realtime publication on this project currently includes only `warehouse_items`:

```sql
-- pg_publication_tables WHERE pubname='supabase_realtime'
public.warehouse_items   ← only this one
-- warehouse_bin_allocations  MISSING
-- warehouse_bins             MISSING
```

Consequences:

1. A bin-to-bin transfer doesn't change `warehouse_items.current_stock` (total is unchanged), so no `warehouse_items` realtime event fires.
2. The bin-level changes happen on `warehouse_bin_allocations` / `warehouse_bins`, which are not published → the realtime subscriptions in `useRealtimeStockUpdates` never fire.
3. React Query has `staleTime: 30s` and `refetchOnWindowFocus: false`, so the cached per-bin breakdown sits there until the user manually triggers a refetch (search change, filter change, page reload).

Secondary issue: the explicit `invalidateQueries` calls in the transfer write paths target `['warehouse-bin-allocations']`, `['warehouse-items']`, `['stock-transactions']`, `['stock-transfer-requests']` — but **not** `['warehouse-items-inventory']`, which is the Inventory tab's actual key. So even users who avoid the realtime path don't get instant feedback.

## Fix (international-standard: DB is the single source of truth; UI listens to CDC)

### 1. DB migration — publish the bin tables to realtime

```sql
ALTER TABLE public.warehouse_bin_allocations REPLICA IDENTITY FULL;
ALTER TABLE public.warehouse_bins            REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.warehouse_bin_allocations;
ALTER PUBLICATION supabase_realtime ADD TABLE public.warehouse_bins;
```

`REPLICA IDENTITY FULL` is required so the realtime payload carries `company_id`, matching the scoped invalidation in `useRealtimeStockUpdates.onBinAllocation`.

### 2. Frontend — also invalidate the Inventory list key explicitly

Three transfer write paths today bypass the inventory key:

- `src/components/warehouse/MoveBinAllocationDialog.tsx` (new, added today) — add `['warehouse-items-inventory']` and `['all-items-location-stock']` to the post-success invalidation list.
- `src/components/warehouse/ItemTransferDialog.tsx` — after the `transfer_stock_fifo` RPC succeeds, invalidate `['warehouse-items-inventory']`, `['warehouse-bin-allocations']`, `['warehouse-items']`, `['all-items-location-stock']`, `['stock-transactions']`. Currently it invalidates nothing.
- Stock Transfer page completion handler (if/when a transfer flips to `completed`): mirror the same invalidations.

This gives belt-and-braces freshness: realtime CDC for passive listeners, explicit invalidation for the user who just clicked.

## Out of scope

- No change to `transfer_stock_fifo` RPC, triggers, or RLS — they are working correctly.
- No change to staleTime or `refetchOnWindowFocus` — keeping the project-wide caching contract intact (per memory `react-query-global-cache-freshness-permanent`).
- Historical inconsistency on the Mar 6 transfer (older ledger rows had source bin_id stamped on the transfer_in row) is an artifact of an earlier RPC version — already fixed in the current RPC; no backfill needed for current balances.

## Files

- New migration: `supabase/migrations/<ts>_publish_bin_tables_realtime.sql`
- Edited: `src/components/warehouse/MoveBinAllocationDialog.tsx`
- Edited: `src/components/warehouse/ItemTransferDialog.tsx`
- Optionally edited: `src/components/warehouse/StockTransferDetailsDialog.tsx` (if it owns the "Complete" action)
