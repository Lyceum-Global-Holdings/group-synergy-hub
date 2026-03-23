
## Best fix: unify the reconciliation engine and complete the missing pieces

### What I found
The current “fix” flow is only partially implemented, so reconciliation still fails for real cases:

1. `useStockAudit.ts` still has its own reconciliation logic and it is incomplete:
   - single-item fix and bulk fix still fetch `warehouse_bin_allocations` without `company_id` scoping
   - `createAllocationForNoBinsItem` still only auto-picks the first bin and does not support the guided bin choice
   - it throws when location is missing instead of using the dialog result

2. `AssignLocationDialog.tsx` is incomplete:
   - it only assigns a **location**, not a **bin**
   - it fetches locations only from `warehouse_location_companies`, but this app still supports legacy `warehouse_locations.company_id` fallback elsewhere
   - that means valid warehouse locations/bins can be missing from the dialog

3. There are real data cases blocking reconciliation:
   - multiple active stock items still have `location_id = null`
   - some items have stock mismatches while location is null
   - some active bins belong to locations that are not present in the junction table, so the current dialog can hide them

4. Reconciliation logic is duplicated in two places:
   - `useStockAudit.ts`
   - `useWarehouseBinAllocations.ts`
   
   That duplication is why one path gets fixed while the other stays broken.

### Best solution
Use **one shared reconciliation engine** and make Stock Audit call that engine instead of maintaining a second, separate fix implementation.

### Implementation plan

#### 1) Centralize reconciliation logic
Move the actual fix logic into shared helper functions inside `src/hooks/useWarehouseBinAllocations.ts` (or a small shared warehouse utility used by both hooks).

Create a single deterministic flow:

```text
For an item:
  1. Load item with company_id + location_id
  2. Load allocations scoped by warehouse_item_id + company_id
  3. If item has no location:
       require explicit location/bin input
  4. If item has no allocations:
       create allocation in chosen bin / first active bin at item location
  5. If item has allocations:
       prefer allocations whose bin.location_id matches item.location_id
       adjust the primary location-matching allocation
  6. If no matching-location allocation exists:
       create one at the chosen/correct bin
```

This removes divergence between Stock Audit fixes and Inventory reconciliation fixes.

#### 2) Finish the guided repair flow
Update `src/components/warehouse/AssignLocationDialog.tsx` so each affected item can select:

- warehouse location
- bin within that location

This should:
- show bins filtered by the selected location
- support both junction-linked locations and legacy `warehouse_locations.company_id`
- only allow active bins
- return `{ itemId, locationId, binId }` for each item

#### 3) Pass explicit overrides into reconciliation
Update `src/hooks/useStockAudit.ts` so the dialog result is passed into the shared engine as an override map.

That means:
- no more “guessing” a bin after the user already picked one
- no more throwing “Could not determine item location” for items that were just assigned
- no stale behavior after refetch

#### 4) Fix company/location scoping everywhere
In the shared reconciliation engine and Stock Audit:
- always scope allocation reads by `company_id`
- when adjusting allocations, prefer bins at the item’s `location_id`
- never fall back to a bin at a different location
- if no active bin exists at the chosen location, report that item as blocked

#### 5) Improve Stock Audit UI behavior
Update `src/components/warehouse/StockAuditTab.tsx` to:
- continue showing Fix / Fix All for both `desync` and `no_bins`
- after location/bin assignment, call the shared engine directly
- show a result summary:
  - fixed
  - created allocations
  - blocked (missing active bin)
  - failed

#### 6) Add visibility for blocked items
Add clearer error/reporting for items that still cannot be reconciled, for example:
- missing location
- no active bins at selected location
- RLS/database write failure

This prevents silent failure and makes the next action obvious.

### Files to update
- `src/hooks/useWarehouseBinAllocations.ts`
- `src/hooks/useStockAudit.ts`
- `src/components/warehouse/AssignLocationDialog.tsx`
- `src/components/warehouse/StockAuditTab.tsx`

### Technical notes
- Keep `warehouse_bin_allocations` as the operational source of truth
- Deterministic bin choice should be:
  - explicit user-selected bin when provided
  - otherwise first active bin by `bin_code ASC` at the item location
- The location picker should reuse the same “junction + legacy fallback” pattern already used elsewhere in the warehouse module
- Do not keep separate reconciliation math in both hooks anymore

### Why this is the best fix
This solves the real issue, not just one symptom:
- fixes missing location/bin assignment
- fixes company-scoping bugs
- fixes hidden locations caused by incomplete location lookup
- eliminates duplicated reconciliation code that keeps drifting out of sync
