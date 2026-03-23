

## Fix: Stock Reconciliation Still Using Old Sequential Code

### Root Cause

There are **two separate reconciliation paths** and the user is hitting the old slow one:

1. **Stock Audit Tab** (`StockAuditTab.tsx`) → calls `useStockAudit.fixAllDesyncs` → uses the new batch RPC `reconcile_stock_batch` — this is fast
2. **Item Master Tab** (`ItemMasterTab.tsx`) → calls `useWarehouseBinAllocations.reconcileStock` → uses the OLD sequential per-item loop with 120+ HTTP calls — this is what the console logs show

The console logs prove the old path is being used: "Processing item: FIX-MNT-000-0017 (current_stock: 0)" comes from `useWarehouseBinAllocations.ts` line 326.

### Fix

**File: `src/hooks/useWarehouseBinAllocations.ts`**

Replace the `reconcileStockMutation` (lines 221–440+) with a call to the batch RPC `reconcile_stock_batch`. The mutation currently:
- Fetches all active items (1 call)
- Consolidates duplicate allocations (N calls)
- Loops through every item sequentially (3 calls per item)

Replace with:
1. Keep Step 0 (consolidate duplicates) — move it to a separate RPC or keep as-is since it only runs for actual duplicates
2. Replace the per-item loop (Step 1 onward) with a single `supabase.rpc('reconcile_stock_batch', ...)` call

Specifically:
- Fetch all active item IDs for the company
- Pass them to `reconcile_stock_batch` RPC
- Parse results and show toast summary

**File: `src/components/warehouse/ItemMasterTab.tsx`** — no changes needed, it already calls `reconcileStock()` which will now use the fast path.

### Implementation Detail

```typescript
// In reconcileStockMutation.mutationFn, after duplicate consolidation:
const { data: items } = await supabase
  .from('warehouse_items')
  .select('id')
  .eq('company_id', selectedCompany.id)
  .eq('status', 'active');

const itemIds = (items || []).map(i => i.id);
const { data, error } = await supabase.rpc('reconcile_stock_batch', {
  p_item_ids: itemIds,
  p_company_id: selectedCompany.id,
  p_overrides: {},
  p_user_id: user?.data?.user?.id || null,
});
```

### Files Modified
- `src/hooks/useWarehouseBinAllocations.ts` — replace sequential loop in `reconcileStockMutation` with batch RPC call

