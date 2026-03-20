

## Fix: Stock Reconciliation Not Working

### Root Cause

The `useStockAudit` hook has a critical bug: when fetching bin allocations (lines 66-83), it fetches **all allocations across all companies** without any `company_id` filter. This means:

1. Allocations from other companies inflate the `bin_total` for shared catalog items
2. Items appear "desynced" when they are actually correct for the selected company
3. Fixing these false desyncs corrupts the data by adjusting allocations based on wrong totals

Additionally, the "no_bins" fix path is not handled — clicking "Fix" on a `no_bins` item throws an error instead of creating the missing allocation.

### Fix — `src/hooks/useStockAudit.ts`

**1. Filter allocations by company (lines 66-83)**

Add a `company_id` filter to the allocation query when a specific company is selected. When viewing "All Companies", scope allocations to only the item IDs fetched in step 1 (using the item ID set).

```
// When fetching allocations, add:
if (!isViewingAllCompanies && selectedCompany?.id) {
  q = q.eq('company_id', selectedCompany.id);
}
```

**2. Fix "no_bins" items (fixDesyncMutation, lines 182-227)**

When `item.bin_count === 0` and `item.current_stock > 0`, instead of throwing an error, look up the item's `location_id`, find the first active bin at that location, and create a new allocation — same logic as `reconcileStock` in `useWarehouseBinAllocations.ts`.

**3. Fix "no_bins" in bulk fix (fixAllDesyncsMutation, lines 230-286)**

Extend the loop to also process `no_bins` items (not just `desync`), applying the same create-allocation logic from point 2.

### Files Modified
- `src/hooks/useStockAudit.ts` — all three fixes in this single file

