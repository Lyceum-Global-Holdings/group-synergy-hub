## Problem

`Stock Movement History` shows `Qty Before / Qty After = -1 / -2` for the LFC bin of "Test 1" while the bin actually holds **3** units. Two separate defects combine to produce this:

1. **Reader RPC fabricates wrong numbers.** `get_bin_scoped_stock_movements` ignores the values stored in `stock_transactions` and recomputes a running balance starting from **0** (`SUM(quantity_change) OVER (PARTITION BY item_id, bin_id ORDER BY created_at ROWS UNBOUNDED PRECEDING…)`). Because there is no opening-balance ledger row for most bins, the running total starts negative and bears no relation to the real bin quantity. The DB row for this bin actually stores `5 → 4` and `45 → 44` (still stale, but not negative).

2. **Writers don't all read the live bin balance.** Several writers accept a caller-supplied `currentStock` and trust it (`StockAdjustmentDialog`, `useStockTransfer`, `ReturnStockFromSublocation`, `BulkStockUpload`, `FinishedGoodsStockAdjustmentDialog`, `SingleItemForm`, GRN/MIR/Putaway/CycleCount, `adjust_bin_allocation_from_scan`). Stale callers (e.g. an open dialog after another user moved stock) write `quantity_before/after` that no longer match the real `warehouse_bin_allocations.allocated_quantity`. That is why `45 → 44` was recorded for a bin currently at 3.

International standard for a perpetual inventory ledger (IFRS / ISO 9001 / GS1 GTS / SAP MM `MSEG`): each posting is **immutable** and must capture the **actual on-hand at the moment of posting** for the scope it affects (item + location + bin). The reader must **trust** the stored balances, not re-derive them.

## Fix

Make the database the single source of truth for `quantity_before` / `quantity_after`, scoped per `(item_id, bin_id)` (or `(item_id, location_id)` when `bin_id` is null), so every writer — current and future — produces correct numbers automatically.

### 1. Database (migration)

a. **`BEFORE INSERT` trigger on `stock_transactions`** — `set_stock_transaction_balances()`:
   - If `bin_id` is set: read `allocated_quantity` from `warehouse_bin_allocations` for `(item_id, bin_id)` (FOR UPDATE if needed for serialization); set `NEW.quantity_before := COALESCE(allocated, 0)`.
   - Else if `location_id` is set: aggregate `allocated_quantity` across that item's bins at that location.
   - Else: fall back to `warehouse_items.current_stock`.
   - Always set `NEW.quantity_after := NEW.quantity_before + NEW.quantity_change`.
   - Overrides any client-supplied value (defense-in-depth — prevents stale callers from corrupting the ledger).

b. **Replace `get_bin_scoped_stock_movements`** to return the stored `quantity_before` / `quantity_after` verbatim. Keep the bin/location scoping and `warehouse_bins`/`warehouse_locations` joins; drop the running-window recompute.

c. **Backfill** existing rows with a one-shot `UPDATE` that reconciles each `(item_id, bin_id)` group by anchoring `quantity_after` of the **most recent** row to current `allocated_quantity` and walking backwards: `quantity_before := quantity_after - quantity_change`, then propagating to the previous row. Same for `(item_id, location_id)` rows where `bin_id IS NULL`. Any drift caused by past writes that bypassed bin allocations is logged into a `stock_ledger_backfill_audit` table for review.

### 2. Frontend cleanup

After the trigger guarantees correctness, remove the now-redundant client-side `quantity_before` / `quantity_after` from every insert call site so they stop competing with the DB:
- `src/components/warehouse/StockAdjustmentDialog.tsx`
- `src/components/warehouse/FinishedGoodsStockAdjustmentDialog.tsx`
- `src/components/warehouse/ReturnStockFromSublocationDialog.tsx`
- `src/components/warehouse/BulkStockUploadDialog.tsx`
- `src/components/warehouse/SingleItemForm.tsx`
- `src/hooks/useStockTransfer.ts`
- `src/hooks/useToolAdjustments.ts`
- Any other `.from('stock_transactions').insert(...)` callers found via grep.

Reader components (`StockMovementDialog`, `FinishedGoodsMovementDialog`, `StockMovementReportDialog`, scheduled telegram report, PDF/CSV exporters) need no logic change — they already render whatever the RPC/table returns.

### 3. Memory updates

- New: `mem://architecture/stock-ledger-immutable-balances` — "DB trigger sets `quantity_before/after` from live bin/location allocation; clients must not pass these fields; reader returns stored values verbatim."
- Update Core: add line "Stock ledger Qty Before/After is set by DB trigger from live bin allocation — never write or recompute client-side."

## Out of scope

- Reconciling allocations themselves (separate audit reconciliation engine already exists, see `mem://features/warehouse/stock-audit-reconciliation-engine`).
- Changing the visual layout of the Stock Movement History dialog.

## Verification

1. Reopen Stock Movement History for `Test 1 @ LFC`: latest row's `Qty After` equals header `Qty 3`; earlier rows walk back consistently.
2. Issue 1 unit via MIR, then open history: new row shows `before = previous after`, `after = before − 1`, header updates to `2`.
3. Scan the bin QR and adjust: same invariant holds.
4. Run `SELECT item_id, bin_id, MAX(quantity_after) FILTER (...) ` spot-check vs `warehouse_bin_allocations.allocated_quantity` — must match for the latest row of every group.
