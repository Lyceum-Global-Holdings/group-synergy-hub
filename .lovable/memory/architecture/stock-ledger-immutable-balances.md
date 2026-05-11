---
name: stock-ledger-immutable-balances
description: DB trigger sets stock_transactions.quantity_before/after from live bin/location allocation; reader returns stored values verbatim
type: architecture
---

`stock_transactions.quantity_before` and `quantity_after` are authoritative and **set by a BEFORE INSERT trigger** (`set_stock_transaction_balances`) from the live state at posting time:

- If `bin_id` is set → reads `warehouse_bin_allocations.allocated_quantity` for `(item_id, bin_id)`.
- Else if `location_id` is set → sums `allocated_quantity` across that item's bins at the location.
- Else → falls back to `warehouse_items.current_stock`.

The trigger always overwrites client-supplied values. Callers may still pass `quantity_before`/`quantity_after` for backward compatibility, but those values are ignored. Do **not** add client-side recomputation.

The reader RPC `get_bin_scoped_stock_movements` returns the stored values verbatim — no running-window recalculation. A backfill at migration time anchored every `(item, bin)` and `(item, location)` group to its current allocated quantity and walked backwards; drift is logged to `stock_ledger_backfill_audit` (admin-readable).
