---
name: SKU-at-Bin Stock Transaction Scope
description: stock_transactions are scoped per (item_id, location_id, bin_id). Readers MUST filter by bin when context exists; writers MUST pass bin_id; trigger validates and auto-fills bin for single-bin items.
type: feature
---

The atomic stock-keeping unit is **(item_id, location_id, bin_id)** — SAP EWM / Oracle WMS / Manhattan style. The same `item_code` in different bins of the same location is a different SKU and must NOT share movement history.

## Rules

- `stock_transactions` carries `location_id` and `bin_id`. Readers (`useStockTransactions`, `StockMovementDialog`, `useStockMovementAnalytics`, `ItemDetailsDialog` recent activity) filter on both whenever a bin is in context.
- `StockMovementDialog` shows a bin selector when the item has multiple bins; defaults to the first bin (never "All bins" silently). "All bins (this location)" is opt-in only.
- All writers MUST pass `bin_id` when known (GRN allocations, transfers, MIR/MRN, opening stock, bulk stock upload, adjustments).
- The DB trigger `stock_transactions_location_guard` (BEFORE INSERT/UPDATE) resolves `location_id`/`company_id` from `warehouse_items`, validates supplied `bin_id` belongs to that location, and auto-fills `bin_id` if the item has exactly one allocation.
- Reconciliation (`stockReconciliation`, `StockAuditTab`) must group by `(item_id, bin_id)` and validate against `warehouse_bin_allocations.allocated_quantity` per bin, then sum to `warehouse_items.current_stock`.
- Diagnostic view: `public.v_stock_transactions_bin_mismatch` lists rows whose bin's location ≠ transaction's location.
