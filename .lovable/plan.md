

# Fix: Stock Reconciliation Adds to Wrong Bin

## Problem

When reconciling stock (lines 350-375 in `useWarehouseBinAllocations.ts`), the code finds a target bin by querying `warehouse_bins` with `.eq('location_id', item.location_id).limit(1)` — this returns an **arbitrary** bin at the location since there's no ordering. If the item already has allocations in a specific bin, the reconciliation should adjust **that existing bin's allocation**, not pick a random one.

Additionally, if no bin is found at the item's location, it falls back to **any active bin in the entire system** (line 366-374), which could be at a completely different location.

## Root Cause

Two issues in the reconciliation logic:

1. **New allocation case** (no existing allocations): It picks any bin at the location via `limit(1)` with no ordering — unpredictable bin selection
2. **Existing allocation case**: It adjusts `allocations[0]` which is the first returned allocation — but doesn't consider if that allocation's bin is at the correct location

## Fix — `src/hooks/useWarehouseBinAllocations.ts`

### Change 1: When item has existing allocations (lines 384-401)
- Filter allocations to only those where the bin is at the item's `location_id`
- If location-matching allocations exist, adjust the first one
- If none match the location, find or create an allocation at the correct location bin

### Change 2: When finding a target bin for new allocations (lines 350-375)
- Query bins at the item's location and **order by `bin_code`** to ensure deterministic selection (picks the first/primary bin consistently)
- **Remove the fallback** to "any active bin" — if no bin exists at the item's location, skip the item and log a warning rather than assigning stock to a random bin elsewhere

### Change 3: Filter allocations by location context
- When fetching existing allocations (line 329-332), join with `warehouse_bins` to get the bin's `location_id`
- Use this to match allocations that belong to the item's location

### Summary of logic after fix:

```
For each item with a stock mismatch:
  1. Get existing allocations WITH bin location info
  2. Filter to allocations at the item's location_id
  3. If location-matching allocations exist:
     → Adjust the first one to make totals match
  4. If no allocations at correct location:
     → Find first bin at item's location (ordered by bin_code)
     → Create new allocation there
  5. If no bin exists at item's location:
     → Skip item, log warning
```

Single file change: `src/hooks/useWarehouseBinAllocations.ts`, lines ~329-421.

