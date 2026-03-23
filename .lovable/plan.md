

## Fix: Slow Stock Reconciliation — Move Audit Query Server-Side

### Problem

The batch RPC (`reconcile_stock_batch`) is already in place for the **fix** operation, but the **audit data loading** itself is still slow. The `useStockAudit` query (lines 38–125) makes multiple sequential HTTP requests:

- Fetches all active `warehouse_items` in 1000-row batches
- Fetches all `warehouse_bin_allocations` in 1000-row batches
- Then joins them client-side

For thousands of items, this means 4–10+ sequential round-trips just to **load the audit view**, plus the same after every fix (due to `invalidateAll()`).

### Solution: Server-side audit summary RPC

Create a single PostgreSQL function `stock_audit_summary` that does the entire audit computation in one DB call — joining items and allocations, computing variance, and returning the audit rows directly.

### Implementation

**1. New database migration — `stock_audit_summary` RPC**

```sql
create or replace function public.stock_audit_summary(
  p_company_id uuid default null
)
returns table(
  id uuid, item_code text, name text,
  current_stock numeric, bin_total numeric,
  bin_count int, variance numeric, status text
)
```

Logic:
- `LEFT JOIN warehouse_bin_allocations` on `warehouse_item_id` (+ company filter if provided)
- `GROUP BY` item
- Compute `bin_total`, `bin_count`, `variance`, `status` in SQL
- Return all rows in one call — no batching needed server-side

**2. Update `src/hooks/useStockAudit.ts`**

Replace the entire `queryFn` (lines 38–125) with a single `supabase.rpc('stock_audit_summary', { p_company_id })` call. Parse results into the existing `StockAuditItem[]` format.

This eliminates all client-side batching loops and reduces the audit load from 4–10 HTTP calls to 1.

### Files
- **New migration**: `stock_audit_summary` RPC function
- **Modified**: `src/hooks/useStockAudit.ts` — replace queryFn with RPC call

### Performance Impact
- Before: 4–10+ sequential HTTP requests to load audit data (~5–15 seconds)
- After: 1 RPC call (~1–2 seconds)

