

## Fix: Stock Reconciliation Not Working

### Root Causes Found

**1. Desync items with `location_id = null` skip the location prompt**
`checkAndFixItems` (StockAuditTab.tsx line 204) only filters for `no_bins` items when checking which items need location assignment. Desync items with existing allocations but `location_id = null` go straight to reconciliation — which then returns "blocked" because it can't determine a location.

**2. Reconciliation engine fails on items with existing allocations but null location**
In `stockReconciliation.ts`, the engine filters allocations by `warehouse_bins.location_id === effectiveLocationId`. When `effectiveLocationId` is null, zero allocations match. It then tries `findFirstActiveBin(null)` which queries for bins with `location_id = null` — returns nothing. Result: "blocked".

The engine should handle the case where allocations already exist: just adjust the first existing allocation directly, regardless of location matching.

**3. Race condition in handleLocationAssignmentComplete**
After `refetch().then(...)`, the `fixAllDesyncs` mutation reads `auditItems` from hook state, but React state may not have updated yet after the refetch promise resolves.

### Database evidence
- Item `8zipperG`: `current_stock=993`, `location_id=null`, has 1 allocation with `qty=1000` → engine can't match location, returns blocked
- Item `INV-LUS-000-002`: `current_stock=415`, `location_id=null`, no allocations → engine returns blocked
- ~40 Lustra items: all have `location_id=null`, zero allocations, stock > 0

### Fix Plan

**File 1: `src/utils/stockReconciliation.ts`**

Update `reconcileItem` logic at step 4 (allocations exist):
- If allocations exist but none match the item's location, AND no location is known (null effectiveLocationId with no override), adjust the **first existing allocation** directly instead of trying to create a new one at an unknown location
- Only return "blocked" when there are truly no allocations AND no location

```text
Current flow:
  allocations exist → filter by location → none match → findFirstActiveBin(null) → blocked

New flow:
  allocations exist → filter by location → none match → 
    if effectiveLocationId is null: adjust first allocation directly
    else: create at effectiveLocationId (existing behavior)
```

**File 2: `src/components/warehouse/StockAuditTab.tsx`**

Update `checkAndFixItems` (line 204):
- Check ALL items (not just `no_bins`) for missing `location_id`
- This ensures desync items with null location also get the location prompt

```typescript
// Change from:
const noBinsItems = itemsToCheck.filter(i => i.status === 'no_bins');
// To:
const itemsNeedingLocationCheck = itemsToCheck; // check all items
```

Then in the location check query result, filter for items where `location_id` is null.

Update `handleLocationAssignmentComplete`:
- Remove the `refetch().then(...)` pattern — pass overrides directly to the mutation without waiting for refetch (the overrides already contain the location/bin data the engine needs)

```typescript
const handleLocationAssignmentComplete = (overrides: Map<string, ReconcileOverride>) => {
  if (pendingFixMode === 'single' && pendingFixItem) {
    const override = overrides.get(pendingFixItem.id);
    fixDesync(pendingFixItem, override);
  } else {
    fixAllDesyncs(overrides);
  }
  setPendingLocationItems([]);
  setPendingFixItem(null);
};
```

### Files Modified
- `src/utils/stockReconciliation.ts` — handle desync items with existing allocations but null location
- `src/components/warehouse/StockAuditTab.tsx` — prompt location for ALL items missing it (not just no_bins); fix race condition

