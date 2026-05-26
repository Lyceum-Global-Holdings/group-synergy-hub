## Goal

Make every Material Issue Note (MIN) appear in each item's Stock Movement History with the **document number, document type, and clickable reference** — aligned with SAP MM / Oracle Inventory / GS1 LIM conventions where every goods-movement line is traceable to its source material document.

## Findings

- `stock_transactions` already has 707 MIN-derived rows (39 `manual` + 668 `transfer`-flavoured) with correct `item_id`, `location_id`, `bin_id`. They DO render in `StockMovementDialog`, **but**:
  1. `reference_type` is written as `'manual'` instead of the standard `'mrn'` → the row looks generic, not a goods-issue document.
  2. The "Reference" column shows the raw `reference_id` UUID; the MIN number is only buried in `notes` ("Material Issue: MIN-20260526-003").
  3. There is no link from the history row back to the source MIN.
- The two `process_material_issue_stock_update` RPC overloads hard-code `reference_type => 'manual'`. The companion `warehouse_stock_movements` row already uses the correct `'material_issue'` + `reference_number` — only `stock_transactions` is out of step.
- Symmetric gap: `material_returns` writes are fine (`reference_type='mrn'`), but no enum value exists for MIN documents specifically — `mrn` is currently shared by both issues and returns, which is acceptable internationally (both are "Material Movement Notes").

## Solution (international standard, SAP MM-style)

### 1. Database migration

- Update both `process_material_issue_stock_update` overloads so the `stock_transactions` insert uses:
  - `reference_type := 'mrn'`
  - `reference_id := p_min_id`
  - keep `notes` as the human readable line.
- Backfill: `UPDATE stock_transactions SET reference_type='mrn' WHERE transaction_type='material_issue' AND reference_type='manual' AND reference_id IN (SELECT id FROM material_issue_notes)`.
- Extend `get_bin_scoped_stock_movements` to also return a resolved `reference_number` and `reference_doc_type` by joining the source document table per `reference_type`:
  - `mrn` → `material_issue_notes.min_number` (issue) or `material_return_notes.mrn_number` (return) — resolved by checking `transaction_type`.
  - `grn` → `goods_receipt_notes.grn_number`.
  - `transfer` → `stock_transfer_requests.request_number` (fall back to `stock_transfers.transfer_number`).
  - `adjustment` → `stock_adjustments.adjustment_number` (or notes).
  - `project` → `construction_projects.project_code`.
- Add a partial index `(reference_type, reference_id)` to keep the join cheap.

### 2. Reader hook + dialog (`useStockTransactions`, `StockMovementDialog`)

- Carry the new `reference_number` and `reference_doc_type` fields through `useStockTransactions`.
- In `StockMovementDialog`, replace the raw-UUID "Reference" cell with:
  - Primary line: document number (e.g. `MIN-20260526-003`) as a `Link` to the source viewer when the doc type is known.
  - Secondary line: small muted label of the document type ("Material Issue Note", "GRN", "Transfer", "Adjustment").
  - Fallback to `—` only when no document is linked (truly manual adjustments).
- Refresh the `transactionTypeLabels` / colour map to also recognise `material_issue` rows that came from the standard MIN flow.

### 3. Verification

- Re-open Inventory → any item issued via MIN-20260525-002 / MIN-20260526-003 → confirm rows show "Material Issue • MIN-…" with link.
- New MIN posted from UI → row appears with `reference_type='mrn'` and resolves to its MIN number.
- No regressions for GRN, transfers, adjustments, project moves.

### Out of scope

- No UI work on the MIN list/print itself.
- No changes to bin allocation or stock numbers (only labelling + linkage).
- No new enum value (`mrn` already exists and is the international "Material Movement Note" convention shared by issues and returns).

## Technical notes

- `stock_transactions.quantity_before/after` continues to be set by the `set_stock_transaction_balances` trigger — untouched.
- The reader RPC stays `SECURITY INVOKER` and respects existing RLS.
- Migration is forward-only and idempotent (the backfill `UPDATE` is safe to re-run).
