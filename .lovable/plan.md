

## Fix: Slow Stock Reconciliation

### Problem
`reconcileItems` processes items **one at a time sequentially**. Each item makes 3–4 separate Supabase HTTP requests (fetch item, fetch allocations, get user, insert/update). For 40+ items, that's 120–160 sequential network round-trips — extremely slow.

### Solution: Server-side batch reconciliation via Supabase RPC

Move the reconciliation logic into a single PostgreSQL function that processes all items in one database call instead of hundreds of client-side round-trips.

### Implementation

**1. New database migration — `reconcile_stock_batch` RPC**

A PL/pgSQL function that:
- Accepts an array of item IDs, a company_id, and an optional JSONB overrides map `{itemId: {locationId, binId}}`
- For each item in a single DB transaction:
  - Reads `current_stock` and `location_id` from `warehouse_items`
  - Sums allocations from `warehouse_bin_allocations` scoped by company
  - If no allocations exist: creates one at the override bin or first active bin at item's location
  - If allocations exist with desync: adjusts the primary allocation
- Returns a table of results: `(item_id, item_code, action, message)`

This replaces 3N+ HTTP calls with 1 single RPC call.

**2. Update `src/utils/stockReconciliation.ts`**

- Keep `reconcileItem` for single-item fixes (still useful, 3 calls is fine for one item)
- Replace `reconcileItems` loop with a single `supabase.rpc('reconcile_stock_batch', {...})` call
- Parse the RPC response into the existing `ReconcileResult[]` format

**3. Update `src/hooks/useStockAudit.ts`**

- `fixAllDesyncsMutation`: pass item IDs + overrides to the new batch function
- No change to `fixDesyncMutation` (single item is already fast enough)

### Technical Details

The RPC function signature:
```sql
create or replace function reconcile_stock_batch(
  p_item_ids uuid[],
  p_company_id uuid,
  p_overrides jsonb default '{}'::jsonb,
  p_user_id uuid default null
) returns table(item_id uuid, item_code text, action text, message text)
```

Key SQL logic inside the function:
- Uses a `FOREACH` loop over the array (all in one DB transaction)
- Queries allocations with `SELECT ... WHERE warehouse_item_id = v_item_id AND company_id = p_company_id`
- Handles insert vs update with standard SQL
- Uses `GREATEST(0, ...)` to prevent negative quantities
- Returns results via `RETURN NEXT`

### Files
- **New migration**: `reconcile_stock_batch` RPC function
- **Modified**: `src/utils/stockReconciliation.ts` — new `reconcileItemsBatch` using RPC
- **Modified**: `src/hooks/useStockAudit.ts` — `fixAllDesyncsMutation` calls batch function

### Performance Impact
- Before: ~120–160 sequential HTTP requests for 40 items (~30–60 seconds)
- After: 1 RPC call (~1–2 seconds)

