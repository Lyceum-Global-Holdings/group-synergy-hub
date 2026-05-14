---
name: dual-quantity-tracking
description: Optional secondary UOM (pieces) tracked alongside the canonical base UOM on items, bins, transactions and GRNs. Per-receipt conversion — no fixed factor.
type: architecture
---

Items can opt into secondary-quantity tracking via `warehouse_items.track_secondary_quantity` + `secondary_uom`. The base UOM stays canonical for valuation, FIFO, and `current_stock` — secondary qty is **counted only**, never used for money math.

Storage:
- `warehouse_items.base_uom`, `secondary_uom`, `track_secondary_quantity`
- `warehouse_bin_allocations.secondary_quantity`
- `stock_transactions.secondary_quantity_change/before/after` + `secondary_uom`
- `grn_items.secondary_quantity_received` + `secondary_uom` + `conversion_note`
- `warehouse_batches.secondary_quantity_remaining` + `secondary_uom`

Trigger `set_stock_transaction_balances` stamps both base and secondary before/after from live bin/location allocations — same authoritative pattern as base. Never recompute these client-side.

Per-receipt conversion: each GRN row stores its own pieces↔base ratio; do not put a fixed conversion factor on the item master (cut sizes vary).

UI: gate dual-qty inputs on `track_secondary_quantity`. Use `<DualQuantityInput>` and `formatDualQty()` from `src/lib/dualQuantity.ts`.
