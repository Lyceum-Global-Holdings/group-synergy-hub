
# Stock Audit View — End-to-End Test Results & Fix Plan

## Test Findings

### What Works Correctly

1. **Tab Integration** — The "Stock Audit" tab is correctly added as the 6th tab in `ItemBinMaster.tsx` with a `ShieldAlert` icon and the tab grid is `grid-cols-6`. All wiring is correct.
2. **Component Structure** — `StockAuditTab.tsx` is complete: summary cards, filterable/searchable table, per-row Fix button (admin-only), Fix All button with confirmation dialog.
3. **Fix Logic** — The `fixDesync` mutation correctly identifies the largest bin allocation and adjusts its quantity so `SUM(bins) = current_stock`. It correctly clamps `reserved_quantity` and recalculates `available_quantity`.
4. **Desynced Items Confirmed** — The 3 known desynced items still exist in the database (they belong to company `04164042-eeea-4e57-b185-90561dff734e`):

| Item | Item Code | Current Stock | Bin Total | Variance |
|---|---|---|---|---|
| Size Lable | SizeLable | 910.00 | 1,000.00 | -90.00 |
| Waistband stripe White | WaistbandstripeW | 60.00 | 100.00 | -40.00 |
| zipper 8in Gray | 8zipperG | 993.00 | 1,000.00 | -7.00 |

(Draw code 50" has `no_bins` status, not `desync`)

5. **Fix mutation is safe** — For `SizeLable`: primary bin has 1000 allocated with 50 reserved. After fix: primary allocation becomes 910, reserved clamped to 50, available = 860. Correct behavior.

### Critical Bug Found: 400 Error for Large Companies

The `useStockAudit` hook fetches all warehouse items and then runs:
```typescript
const { data: allocations } = await supabase
  .from('warehouse_bin_allocations')
  .select('warehouse_item_id, allocated_quantity')
  .in('warehouse_item_id', itemIds);  // ALL item IDs in URL query string!
```

The main company (`11a46626`) has **702 active items**. When all 702 UUIDs are passed to `.in()`, the resulting URL exceeds the maximum length limit and Supabase returns **400 Bad Request** — this is exactly the error visible in the network logs from the current session. The Stock Audit tab shows a loading spinner forever or an empty table for this company.

The company with the desyncs (`04164042`) only has 35 items, so it works fine there.

## The Fix

### File: `src/hooks/useStockAudit.ts`

Instead of fetching items first and then querying allocations with `.in(itemIds)`, the hook should fetch **all bin allocations scoped to the company** in a single separate query, without passing item IDs in the URL. Both queries are then joined in JavaScript.

**Current (broken for large companies):**
```typescript
// Step 1: fetch items (702 items)
const { data: items } = await supabase.from('warehouse_items').select(...).eq('company_id', companyId);
const itemIds = items.map(i => i.id); // 702 UUIDs

// Step 2: passes 702 UUIDs into URL — causes 400 Bad Request
const { data: allocations } = await supabase
  .from('warehouse_bin_allocations')
  .select('warehouse_item_id, allocated_quantity')
  .in('warehouse_item_id', itemIds); // URL too long!
```

**Fixed approach:**
```typescript
// Step 1: fetch items (as before)
const { data: items } = await supabase.from('warehouse_items').select(...).eq('company_id', companyId);

// Step 2: fetch ALL allocations for the company via a join on warehouse_items — no long ID list in URL
const { data: allocations } = await supabase
  .from('warehouse_bin_allocations')
  .select('warehouse_item_id, allocated_quantity, warehouse_items!inner(company_id)')
  .eq('warehouse_items.company_id', companyId);
```

If the join syntax proves tricky, an alternative is to chunk the `itemIds` array into batches of 100 and run parallel queries, then merge results.

The simplest and most robust fix is to use a **Supabase RPC** or join-based query. Given existing patterns in this codebase, the join approach is preferred.

## Summary

- **1 file to fix**: `src/hooks/useStockAudit.ts` — replace the `.in(itemIds)` call with a company-scoped join query
- **0 other files need changes** — the component and page integration are correct
- After this fix, the Stock Audit tab will load correctly for all companies including the main one with 702 items
- The 3 desynced items will appear and the Fix / Fix All buttons will work as intended

## Technical Detail — Exact Code Change

In `src/hooks/useStockAudit.ts`, replace lines 41–46 (the `.in()` call) with:

```typescript
// Fetch bin allocations scoped to this company via a join — avoids URL length limits
const allocQuery = supabase
  .from('warehouse_bin_allocations')
  .select('warehouse_item_id, allocated_quantity, warehouse_items!inner(company_id, status)');

if (!isViewingAllCompanies && selectedCompany?.id) {
  allocQuery.eq('warehouse_items.company_id', selectedCompany.id);
}

const { data: allocations, error: allocError } = await allocQuery;
```

If the inner join filter syntax is not supported, a safe chunked fallback:
```typescript
const CHUNK_SIZE = 100;
const chunks = [];
for (let i = 0; i < itemIds.length; i += CHUNK_SIZE) {
  chunks.push(itemIds.slice(i, i + CHUNK_SIZE));
}
const allAllocations = (await Promise.all(
  chunks.map(chunk =>
    supabase
      .from('warehouse_bin_allocations')
      .select('warehouse_item_id, allocated_quantity')
      .in('warehouse_item_id', chunk)
      .then(r => r.data || [])
  )
)).flat();
```
