## Diagnosis

On `/warehouse/bin-allocations` (`BinAllocationsTab.tsx`) the only row actions today are **QR** and **Delete**. There is **no "Move stock" / transfer action** at all. Header buttons are: Bulk QR, Return Stock, Allocate Item to Bin.

What you're seeing as "submits but stock doesn't move" almost certainly comes from one of these two adjacent flows being used as a workaround:

1. **Stock Transfer page (`CreateStockTransferDialog`)** — only inserts a row into `stock_transfer_requests` with `status='pending'`. It never calls `transfer_stock_fifo`, so no allocation actually changes. The transfer sits in approval limbo and on-hand quantities stay identical at source and destination. This matches the symptom exactly.
2. **Item Master → Transfer (`ItemTransferDialog`)** — does call `transfer_stock_fifo` but only after the user confirms the second "Verification" dialog; closing it early leaves the request in `approved` state with no physical move.

Bin Allocations itself has no move action, so a user who expects SAP-EWM-style "click the row → move to another bin/warehouse" finds nothing happens.

## International-standard fix (SAP EWM "Internal Stock Transfer / Posting Change")

In SAP EWM / Oracle WMS / Manhattan, the canonical pattern for moving stock between warehouses is a **bin-to-bin posting change** executed directly from the stock overview, atomically updating both source and destination allocations and writing two ledger rows (issue + receipt). The project already has the correct primitive (`transfer_stock_fifo` RPC, per `mem://architecture/warehouse-batch-fifo-logic` and `mem://architecture/stock-transactions-location-scope`); it just isn't surfaced here.

## Changes

### 1. Add `MoveBinAllocationDialog.tsx` (new, frontend only)
- Inputs: read-only source (item + bin + location + on-hand), destination bin picker grouped by warehouse, quantity (≤ available), optional reason/notes.
- Destination bin list: `useWarehouseBins({ skipLocationFilter: true })` filtered to user's editable locations via `useCurrentUserLocationPermissions` (respects `mem://access-control/hierarchical-location-permissions`).
- On submit, in one click:
  1. Insert a `stock_transfer_requests` row with `status='completed'`, `transfer_type='location'`, source/destination bins, `company_id` from the allocation.
  2. Insert the matching `stock_transfer_items` row.
  3. Call `supabase.rpc('transfer_stock_fifo', { p_item_id, p_from_bin_id, p_to_bin_id, p_quantity, p_company_id, p_user_id, p_transfer_number, p_transfer_id })`.
  4. Toast success/failure, invalidate `warehouse_bin_allocations`, `warehouse_items`, `stock_transactions`.
- Guards: same-bin rejection, quantity > 0 and ≤ `available_quantity`, surfaces RPC errors verbatim (no silent failures).

### 2. Wire it into `BinAllocationsTab.tsx`
- Add `moveAllocation` state.
- Add an `ArrowRightLeft` icon button in the row actions column (between QR and Delete), gated by `useIsAdminOrHigher` for write capability, with tooltip "Move stock to another bin/warehouse".
- Render `<MoveBinAllocationDialog allocation={moveAllocation} ... />` next to the existing dialogs.

### 3. Tighten `CreateStockTransferDialog` (small UX fix, no logic change to RPC)
- After creating a transfer request, show an inline notice: *"Transfer request created (pending). Stock will move once approved and completed."* This removes the "submits but stock doesn't move" surprise on that page, and points users to the Approval Console or the new Bin Allocations Move action for instant moves.

## Out of scope
- No DB migrations. The `transfer_stock_fifo` RPC, RLS, and triggers are already correct (per memory `stock-ledger-immutable-balances` and `stock-transactions-location-scope`).
- No changes to ItemTransferDialog, Asset Transfer, or the multi-step approval workflow.

## Files
- New: `src/components/warehouse/MoveBinAllocationDialog.tsx`
- Edited: `src/components/warehouse/BinAllocationsTab.tsx`
- Edited: `src/components/warehouse/CreateStockTransferDialog.tsx` (notice only)
