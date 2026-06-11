## Root cause

`stock_transactions` has a BEFORE-INSERT trigger `set_stock_transaction_balances` that reads the **live** `warehouse_bin_allocations` sum and sets:

- `qty_before = current allocation`
- `qty_after  = current allocation + quantity_change`

So callers must insert the ledger row **before** updating the bin allocation. Two RPCs do it in the wrong order, double-counting the new quantity:

1. **`bulk_provision_inventory_from_catalog`** (source of the "Opening Stock via bulk catalog import" row in the screenshot) writes `warehouse_bin_allocations` first, then `stock_transactions`. With bin NGN truly going 0 → 1000, the ledger gets `before=1000, after=2000`.
2. **`approve_grn_with_allocations`** (added last turn) has the same swapped order — every approved GRN will record inflated before/after.

`warehouse_items.current_stock` and `warehouse_bin_allocations.allocated_quantity` are correct (the picker still shows Qty 1000). Only `stock_transactions.quantity_before/after` (and their secondary counterparts) are wrong.

## Fix

### 1. Swap write order in `bulk_provision_inventory_from_catalog`
Insert the `stock_transactions` row **first**, then upsert `warehouse_bin_allocations`. No other logic changes.

### 2. Swap write order in `approve_grn_with_allocations`
Reorder STEP A (allocations) and STEP B (ledger) so ledger inserts run first per line, then allocations are upserted. Validation block, status flip, and guard trigger stay as-is.

### 3. One-time backfill of historical ledger rows
Add a `recompute_stock_ledger_balances()` SECURITY DEFINER RPC (admin-only) that, per `(company_id, item_id, location_id, bin_id)`, walks `stock_transactions` ordered by `(created_at, id)` and rewrites `quantity_before`, `quantity_after`, `secondary_quantity_before`, `secondary_quantity_after` as a running sum starting from 0. Execute it once inside the migration so the existing inflated row in the screenshot becomes `before=0, after=1000`. Future inserts continue to flow through the BEFORE trigger.

The backfill is safe to re-run; it never touches actual stock or allocations, only the audit columns. Other write paths (issue notes, returns, transfers, scanned adjustments) already insert the ledger row first via `set_stock_transaction_balances`, so they aren't affected — and the backfill leaves their correctly-recorded values unchanged because the running sum matches.

## Out of scope

- UI changes — the bin scan dialog, ledger table, and KPI cards already render whatever the DB stores.
- Trigger redesign — keeping the current "ledger-first" contract is the SAP/Oracle EBS convention; only the two offending RPCs need to follow it.
