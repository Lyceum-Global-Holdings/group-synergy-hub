## Goal
In `GrnBinAllocationDialog`, eliminate the manual "Select item…" and "Select bin…" steps whenever we have enough information to resolve them automatically. Only fall back to manual pickers when auto-resolve can't find a unique answer.

## Behaviour after the change

When the dialog opens, for each received GRN line:

1. **Auto-link the Warehouse Item**
   - If `warehouse_item_id` is already set → use it (current behaviour).
   - Else if `item_code` is set → look it up in `warehouse_item_catalog` (active, exact `item_code` match) and call `ensure_warehouse_item_for_company(company_id, catalog_id)` to provision/get the per-company `warehouse_items.id`. Store it on the row.
   - Else → leave the inline catalog picker visible (unchanged fallback).

2. **Auto-load the Destination Bin** (based on the location currently selected in the global header — same `selectedRootLocationId` we already compute)
   - Look up existing `warehouse_bin_allocations` for `(warehouse_item_id, company_id)` scoped to the selected location → if a row exists, pre-select that bin (preferred: the one with the largest `allocated_quantity`, so we top up an existing pile rather than scatter).
   - Else if the item's `warehouse_items.location_id` matches the selected location and has a default bin in `activeBins` → pre-select it.
   - Else if exactly one `activeBins` row exists in the selected location → pre-select it.
   - Else → leave the bin Select empty so the user picks (current fallback).

3. The user can still override either field via the existing picker/Select.

4. "Confirm & Approve" enables as soon as every row has both a warehouse item and a bin — which, for the common case, will be immediately after the dialog opens.

5. Loading state: show a small "Resolving…" indicator on the row while auto-link/auto-bin is in flight; disable Confirm until all rows finish resolving.

## Files to change

- `src/components/warehouse/GrnBinAllocationDialog.tsx` — only file edited.
  - Add `autoResolveItem(rowId, itemCode)` helper that queries `warehouse_item_catalog` by `item_code` (use the existing supabase client, single-row `.maybeSingle()`) and reuses `handlePickCatalogItem` logic for linking.
  - Add `autoPickBin(rowId, warehouseItemId)` helper that queries `warehouse_bin_allocations` filtered by `warehouse_item_id`, `company_id`, and (when known) the selected root location, ordered by `allocated_quantity desc`, then falls back to the single-active-bin rule.
  - Wire both into the existing `useEffect` that initialises `rows` when `open` flips true. Track a per-row `resolving` flag.

## Out of scope

- No DB migration.
- No change to `GrnDetailsDialog`, `useGoodsReceiptNotes`, or the approval RPC — the auto-resolved values flow through the existing `onConfirm({ allocations, itemLinks })` path.
- No change to the create-GRN flow (already correct after the previous fix).
