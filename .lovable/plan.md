# Fix: Admins can't approve GRN — allocation dialog shows "No items"

## Root cause

The GRN in the screenshot (`GRN-20260611-001`) has `grn_items.warehouse_item_id = NULL` (confirmed in DB). `GrnBinAllocationDialog` filters items to `warehouse_item_id && quantity_received > 0`, so the table is empty and "Confirm & Approve" stays disabled. This happens whenever a GRN was created without picking an item from the warehouse catalog (or the lookup-by-`item_code` at create time found no match — here `item_code` is null and the catalog code lives in `item_name`).

Existing UI gating (admin-only buttons) and triggers are working — the blocker is purely data: unlinked items.

## Plan

1. **`GrnBinAllocationDialog.tsx`** — instead of hiding unlinked rows, render every received row. For rows missing `warehouse_item_id`, replace the "Destination Bin" cell with a two-step picker:
   - Warehouse Item combobox (reuse the same item-search pattern used in `CreateGrnDialog.tsx` lines ~600-640, scoped to the GRN's company).
   - Once an item is chosen, show the bin select.
   - Track per-row `{ warehouseItemId, binId }` in local state.
   - "Confirm & Approve" enabled only when every row has both selected.

2. **On confirm**, build allocations using the chosen `warehouseItemId` (existing or newly selected) and pass them through to `useApproveGoodsReceiptNote` as before.

3. **`useGoodsReceiptNotes.ts` `approveGrnMutation`** — before the existing allocation/stock work, persist any newly-linked `warehouse_item_id` back to `grn_items` (`update grn_items set warehouse_item_id = ... where id = ...`) so the GRN, ledger, and downstream reports stay consistent.

4. **No DB migration needed.** Triggers/RPCs already accept the linked item; the change is purely client-side data completion.

## Verification

- Open `GRN-20260611-001` as admin → click Approve → dialog now lists the row with item + bin pickers → pick both → Confirm & Approve succeeds, GRN flips to approved/completed, stock lands in the chosen bin.
- Open a GRN whose items already have `warehouse_item_id` (e.g. `GRN-20260606-001`) → dialog behaves exactly as today (no picker, just bin select).
- Non-admin still sees no Approve button.
