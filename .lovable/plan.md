

## Fix: Show All Bin Locations During Inventory Transfers

### Problem
When transferring items, both source and destination bin dropdowns are filtered by the user's location permissions. Users cannot see or select bins at locations they don't have explicit edit access to — making cross-location transfers impossible for non-admin users.

### International Standard Alignment
Per ISO 22745 (open technical data) and warehouse management best practices, **visibility of storage locations should not be restricted during transfer operations**. The transfer approval workflow (already in place) is the proper control point — not the bin selector. Restricting visibility breaks operational efficiency and forces admin involvement for routine moves.

### Solution

**Principle**: Separate *visibility* from *write authorization*. All users see all bins for transfers; the approval workflow and RLS enforce authorization.

**1. `src/hooks/useWarehouseBins.ts`** — Add an option to bypass location filtering

Add an optional `skipLocationFilter` parameter. When `true`, the hook returns all bins regardless of location permissions. The default remains filtered for other contexts (Bin Master management).

**2. `src/components/warehouse/ItemTransferDialog.tsx`** — Two changes:

- Call `useWarehouseBins({ skipLocationFilter: true })` so the destination bin dropdown shows all bins across all locations
- Remove the `editLocationIds` filter from the `binsWithStock` memo (source bins) — source bins should show wherever the item has stock, regardless of the user's edit permissions. The transfer approval workflow handles authorization.

### Files to Edit
1. `src/hooks/useWarehouseBins.ts` — add `skipLocationFilter` option to the hook
2. `src/components/warehouse/ItemTransferDialog.tsx` — use unfiltered bins for both source and destination selectors

### What stays the same
- RLS on `warehouse_bins` already allows all authenticated users to SELECT (no change needed)
- Transfer approval workflow remains the authorization gate
- Bin Master management page keeps its existing location-filtered view

