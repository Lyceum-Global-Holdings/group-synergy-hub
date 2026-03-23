

## Fix: Stock Reconciliation and Bin Allocation Creation

### Root Causes Identified

**1. Items with `location_id = null` break reconciliation silently**
Many active items with stock > 0 have no `location_id` set. Both `reconcileStock` (in `useWarehouseBinAllocations.ts`) and `createAllocationForNoBinsItem` (in `useStockAudit.ts`) check `if (!itemData?.location_id)` and skip/throw — so these items never get allocations.

**2. Stock Audit "Fix" button only appears for `desync` status, not `no_bins`**
In `StockAuditTab.tsx` line 319: `if (row.original.status !== 'desync') return null;` — the Fix button is hidden for `no_bins` items, even though the backend `fixDesyncMutation` already handles them.

**3. "Fix All" button only counts desynced items, ignores `no_bins`**
Line 427: `{isAdmin && summary.desynced > 0 && (` — the button only appears when there are desynced items. The count shown also excludes `no_bins`. The mutation itself already handles both statuses (line 283), but the UI gates it.

### Fix Plan

**File 1: `src/components/warehouse/StockAuditTab.tsx`**

- **Line 319**: Change condition from `status !== 'desync'` to `status === 'ok'` so Fix button shows for both `desync` and `no_bins` items
- **Line 427**: Change condition to `summary.desynced + summary.noBins > 0`
- **Line 436**: Update button label to show combined count: `Fix All ({summary.desynced + summary.noBins})`
- **Line 493**: Update dialog description to mention "no bins" items too

**File 2: `src/hooks/useStockAudit.ts` — Add location prompt support**

- Update `createAllocationForNoBinsItem` to accept an optional `locationId` override parameter
- When `location_id` is null and no override is provided, throw a descriptive error: `"Item has no warehouse location assigned. Please assign a location first."`

**File 3: `src/components/warehouse/StockAuditTab.tsx` — Guided location assignment for no-location items**

Before running Fix or Fix All, check if any target items have `no_bins` status. For those, show a pre-fix dialog that:
1. Fetches the item's `location_id` from `warehouse_items`
2. If null, shows a dropdown for the user to pick a warehouse location + bin
3. Saves the location to the item (`warehouse_items.update`) before proceeding with allocation creation
4. Once all items have locations assigned, proceeds with the normal fix flow

Implementation:
- New component `AssignLocationDialog.tsx` — a modal listing items missing locations with a location dropdown per row
- When user confirms, batch-updates `warehouse_items.location_id` for each item, then triggers the original fix mutation
- For Fix All: filter items needing location assignment, show dialog first if any exist, then run fixAll after

**File 4: `src/hooks/useStockAudit.ts` — Company-scoped allocation queries for fix mutations**

- `fixDesyncMutation` (line 239-243): Add `.eq('company_id', selectedCompany.id)` filter when fetching allocations for the desync fix
- `fixAllDesyncsMutation` (line 297-300): Same company filter
- This prevents adjusting allocations belonging to other companies

### Summary of Changes

| File | Change |
|------|--------|
| `StockAuditTab.tsx` | Show Fix button for `no_bins` items; Fix All includes `no_bins` count; pre-fix location assignment dialog |
| `useStockAudit.ts` | Company-scope allocation queries in fix mutations; better error for missing locations |
| `AssignLocationDialog.tsx` (new) | Guided dialog for assigning warehouse location + bin to items missing `location_id` before reconciliation |

### New Component: `AssignLocationDialog.tsx`

Props: `items: StockAuditItem[]`, `open`, `onOpenChange`, `onComplete: () => void`

For each item without a location:
- Row shows item code, name, current stock
- Location dropdown (warehouse locations only)
- On submit: updates each item's `location_id` in `warehouse_items`, then calls `onComplete`

