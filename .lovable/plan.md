
Fix stock reconciliation by making the Inventory/Item Master reconcile path honor the user’s selected warehouse location instead of calling the batch RPC with empty overrides.

What I found
- The blocked results are real, not just UI noise: many Lustra items have `current_stock > 0`, `alloc_count = 0`, and `location_id = null`.
- `reconcile_stock_batch` only creates a bin allocation when it has either:
  - an override bin/location, or
  - an existing `warehouse_items.location_id`.
  Otherwise it returns `blocked - No location/bin available`.
- `useStockAudit` can pass overrides from `AssignLocationDialog`, but `useWarehouseBinAllocations.reconcileStock` currently sends:
  ```ts
  p_overrides: {}
  ```
  so the selected location is ignored there.
- The current Inventory page already has access to `globalLocationId` from `LocationFilterContext`, but reconciliation does not use it.
- Data check shows the affected company has many items with null `location_id`, while available warehouse locations/bins are limited by company mapping. So if the selected location is meant to be the target, it must be passed explicitly into reconciliation.

Best solution
Use the selected global location as an explicit reconciliation target in the Item Master flow, and reuse the same “location + first active bin” logic before calling the batch RPC.

Implementation plan

1. Update `src/hooks/useWarehouseBinAllocations.ts`
- Accept a reconciliation context/argument for the selected location ID.
- Before calling `reconcile_stock_batch`, fetch:
  - all active items for the company
  - items missing `location_id`
  - first active bin for the selected location
- Build `p_overrides` for items that need help:
  - if item has no `location_id` and a global location is selected, set:
    ```text
    { itemId: { locationId: selectedLocationId, binId: firstActiveBinAtSelectedLocation } }
    ```
- If no active bin exists at the selected location, fail fast with a clear error instead of silently skipping.

2. Persist the selected location onto affected items
- For items reconciled via selected location, update `warehouse_items.location_id` before or as part of reconciliation flow.
- This ensures future audits and stock operations use the same warehouse location consistently.

3. Update `src/components/warehouse/ItemMasterTab.tsx`
- Pass `globalLocationId` into `reconcileStock(...)`.
- If no location is selected, block reconciliation with a clear message like:
  “Select a warehouse location first to reconcile items without locations.”
- Keep the current button behavior, but make it deterministic.

4. Tighten the reconciliation result handling
- Align client-side action parsing with actual RPC return values (`fixed`, `created`, `blocked`, `failed`) so success/skipped counts are correct.
- Show a better summary:
  - allocations created
  - allocations adjusted
  - blocked because no active bin at selected location
  - failed

5. Optional hardening in `reconcile_stock_batch`
- Make the RPC slightly more defensive:
  - if an override location/bin is provided, always use it for no-allocation items
  - keep updating `warehouse_items.location_id` when override location is used
- This preserves one source of truth and avoids drift between client and RPC behavior.

Why this fixes the issue
- Right now the selected location exists only in UI state and is never sent to reconciliation.
- After this change, null-location items will no longer be skipped: they will be assigned to the selected location and added to that location’s first active bin.
- This matches the expected behavior the user described and keeps the batch reconciliation fast.

Files to update
- `src/hooks/useWarehouseBinAllocations.ts`
- `src/components/warehouse/ItemMasterTab.tsx`
- possibly `supabase` migration for a small RPC hardening update if needed

Technical notes
- Keep `warehouse_bin_allocations` as the operational source of truth.
- Use company-scoped allocations, but location-scoped bins.
- Bin selection should be deterministic:
  - selected location’s first active bin by `bin_code ASC`
  - otherwise block with a clear error
- Do not rely on `warehouse_items.location_id = null` items being auto-resolved by the RPC without explicit overrides.
