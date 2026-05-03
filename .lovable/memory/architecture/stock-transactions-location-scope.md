---
name: SKU-at-Bin Stock Transaction Scope
description: stock_transactions are scoped per (item, location, bin). Bin's physical location is authoritative. Quantity before/after are per-bin, never item-total. Reader must use get_bin_scoped_stock_movements RPC.
type: feature
---

The atomic stock-keeping unit is **(item_id, location_id, bin_id)** — SAP EWM / Oracle WMS / Manhattan style. The same `item_code` in different bins is a distinct SKU and MUST NOT share movement history or quantities.

## Rules

- `warehouse_bins.location_id` is the authoritative physical location for any stock_transaction. The `stock_transactions_location_guard` BEFORE trigger overwrites `stock_transactions.location_id` from the bin's location whenever `bin_id` is present. The trigger rejects any `bin_id` that is not allocated to the item.
- `stock_transactions.quantity_before` and `quantity_after` are **bin-level** balances, not item totals. All writers (bulk stock upload, GRN, MIR/MRN, transfers, adjustments, opening stock, cycle counts) must compute these from `warehouse_bin_allocations.allocated_quantity` for the specific bin, not from `warehouse_items.current_stock`.
- Item total stock (`warehouse_items.current_stock`) is synced from `SUM(warehouse_bin_allocations.allocated_quantity)` by `trg_sync_item_stock_after_bin_allocation`. The legacy triggers `update_item_stock_trigger` and `update_stock_trigger` (which set `current_stock = quantity_after` from a single tx row) have been DROPPED — never reintroduce them.
- All readers MUST use the RPC `public.get_bin_scoped_stock_movements(p_item_id, p_location_id, p_bin_id)` which recomputes per-bin running balances via window functions and joins bin/location for display. Direct queries against `stock_transactions` for movement history are forbidden.
- `StockMovementDialog` shows ONLY bins whose `warehouse_bins.location_id = locationId` when a location is in scope. It defaults to the first bin (never silently merges bins). Cross-location bins are not shown for that location.
- `ItemMasterTab` passes the global location filter (`globalLocationId`) into `StockMovementDialog` so history is scoped to the user's selected physical site.
- Diagnostics: `v_stock_transactions_balance_drift` lists rows whose stored before/after differs from the per-bin computed running balance.
