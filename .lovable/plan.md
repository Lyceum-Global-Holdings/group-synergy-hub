# Stop cross-bin bleed in Stock Movement history

## Problem (verified in DB)

`INV-HAW-000-0389` at location `Lyceum Holdings Warehouse` (warehouse_item `80210bce…`) is split across two bins:

- `LAN` — 163 units
- `4-A-2-2` — 20 units

The Stock Movement dialog is currently keyed by `(item_id, location_id)` only, so it shows every transaction for that warehouse_item — mixing the two bins together. That is why the user sees rows like `Bulk stock upload - Bin: 4-A-2-2` and `Bulk stock upload - Bin: LAN` listed under what they expect to be a single bin's history. Same problem exists wherever the same SKU lives in more than one bin.

International WMS standards (SAP EWM HU/Bin, Oracle WMS LPN, Manhattan, NetSuite Bin Mgmt) treat **(item, location, bin, batch/serial)** as the atomic stock-keeping unit. We already enforce item + location; we need to add bin scoping.

## Solution overview

Make `stock_transactions` carry an explicit `bin_id` and scope every reader/writer in the system per bin. Where a UI surface represents a multi-bin warehouse_item (e.g. the Inventory list row), the movement history opens with a bin selector and defaults to "All bins (this location)" only when no bin context exists; once a bin is chosen, history is strictly filtered.

## Database migration

1. `ALTER TABLE public.stock_transactions ADD COLUMN bin_id uuid NULL REFERENCES public.warehouse_bins(id);`
2. Index: `CREATE INDEX idx_stock_transactions_item_loc_bin ON stock_transactions(item_id, location_id, bin_id, created_at DESC);`
3. Best-effort backfill: parse the existing `notes` pattern `Bin: <code>` and resolve to `bin_id` via `warehouse_bins.bin_code` scoped to the same `location_id` — only update rows where exactly one match exists; leave ambiguous ones NULL.
4. Extend the existing `trg_stock_transactions_location_guard` trigger so that when a writer supplies `bin_id` it is validated to belong to the resolved `location_id`; when not supplied and the warehouse_item has only ONE active bin allocation, auto-fill `bin_id` from that allocation.
5. Diagnostic view `v_stock_transactions_bin_mismatch` listing rows whose `bin_id`'s `location_id` ≠ the transaction's `location_id`.

## Writer changes (every path that inserts stock_transactions)

Every existing writer must pass `bin_id`. Files to update:

- `src/components/warehouse/StockAdjustmentDialog.tsx` — add bin picker (defaults if single bin allocation).
- `src/components/warehouse/BulkAdjustmentDialog.tsx` — per-row bin selection.
- `src/components/warehouse/BulkStockUploadDialog.tsx` — already resolves bin by code; pass resolved `bin_id` into the insert.
- `src/components/warehouse/CreateItemDialog.tsx` / `SingleItemForm.tsx` (opening stock) — pass the bin chosen for the initial allocation.
- `src/components/warehouse/ReturnStockFromSublocationDialog.tsx`, `ItemTransferDialog.tsx`, `CreateStockTransferDialog.tsx`, `CreatePutawayDialog.tsx` — pass source/destination bin per leg (transfer_out tagged with source bin, transfer_in with destination bin).
- GRN allocation flow (`grn-approval-allocation-workflow`) — already knows the destination bin; thread it into the txn insert.
- Material Issue / MRN flows in `MaterialIssueReturn.tsx` and tool issue/return — pass source bin (FIFO picker already resolves bins).
- Construction issue/return paths that mirror into `stock_transactions`.

`useStockTransactions.createTransaction` and `CreateStockTransactionData` (`src/types/stockTransaction.ts`) gain optional `bin_id`.

## Reader changes

- `src/hooks/useStockTransactions.ts` — accept `binId?: string | null`, add `.eq('bin_id', binId)` (and `.is('bin_id', null)` when explicitly null). Cache key becomes `['stock-transactions', itemId, locationId, binId]`.
- `src/components/warehouse/StockMovementDialog.tsx`:
  - New optional props `binId`, `binCode`.
  - Render bin selector in the header populated from `warehouse_bin_allocations` for that warehouse_item; default to the prop if provided, else "All bins at this location" with a warning chip explaining why values may aggregate.
  - Header line shows `Item @ Location › Bin <code>` when scoped.
  - New "Bin" column in the table for transparency.
- `src/components/warehouse/ItemDetailsDialog.tsx` — each bin allocation row gets a "View movements" action that opens `StockMovementDialog` with that `bin_id`.
- `src/components/warehouse/ItemMasterTab.tsx`:
  - Inventory row's "Stock Movement" button: if the row has exactly one allocation, open scoped to that bin; otherwise open at location scope with the bin selector visible.
- `src/components/warehouse/BinAllocationsTab.tsx` — add "View movements" per allocation row.
- `src/components/warehouse/valuation/MovementAnalysisTab.tsx` and `useStockMovementAnalytics.ts` — accept optional `binId` and propagate when called from a bin-scoped context.
- Tool Management (`useToolBinAllocations`, `ToolBinAllocationsPanel`) — same per-bin scoping for tool transactions if/when it shares the table.

## Reconciliation impact

Stock Audit / Reconciliation (`src/utils/stockReconciliation.ts`, `StockAuditTab.tsx`) currently rolls up to warehouse_item.current_stock. After this change, reconciliation must group transactions by `(item_id, bin_id)` and compare against `warehouse_bin_allocations.allocated_quantity`, then sum bins to validate `warehouse_items.current_stock`. This prevents a multi-bin item from being "reconciled" by averaging bins together — the explicit complaint.

## Memory updates

- Update `mem://architecture/stock-transactions-location-scope.md` → rename concept to **SKU-at-Bin**: atomic key is `(item_id, location_id, bin_id)`. Readers MUST filter by all three when a bin context exists; writers MUST supply `bin_id`.
- Add a Core rule: "Stock movement history is per-bin. Never aggregate transactions across bins of the same warehouse_item."

## Out of scope

- Batch/serial layering on top of bin (already tracked separately via `batch_id`).
- Backfilling transactions whose `notes` don't contain a parseable `Bin:` token — they remain `bin_id NULL` and surface only under "All bins" view with a legacy badge.
