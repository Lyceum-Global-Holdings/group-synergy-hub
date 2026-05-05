## Goal
When stock is issued via a Material Issue Note (MIN), record each bin-level deduction in the canonical `stock_transactions` table so it appears in the standard Stock Movement History (SAP MM "Material Document" / 261 movement type equivalent).

## Root cause
`process_material_issue_stock_update` currently:
- Updates `warehouse_bin_allocations` (correct).
- Inserts into `warehouse_stock_movements` (legacy table).
- **Does NOT insert into `public.stock_transactions`** — the table read by `get_bin_scoped_stock_movements`, the official per-bin movement history viewer (per memory: *SKU-at-Bin Stock Transaction Scope*).

Result: MIN issues silently bypass the audit trail shown to users.

## Fix (international standard — SAP MM Goods Issue / ISO 9001 traceability)
Extend the RPC to additionally write **one `stock_transactions` row per consumed bin**, with:
- `transaction_type = 'material_issue'`
- `reference_type = 'manual'` (existing enum has no `min` value; matches what `IssueItemsDialog` already uses)
- `reference_id = p_min_id`
- `item_id`, `bin_id`, `location_id` (location_guard trigger normalizes from bin)
- `quantity_change = -v_take` (negative)
- `quantity_before / quantity_after` at **bin granularity** (`v_before` / `v_before - v_take`) — matches the per-bin running balance contract
- `company_id` resolved from `material_issue_notes`
- `notes = 'Material Issue: <MIN#>'`
- `created_by = auth.uid()`

## Technical change
**Single migration** — recreate `process_material_issue_stock_update` to:
1. Resolve `v_company_id` from `material_issue_notes` once.
2. Inside the FIFO loop, after updating the bin allocation, INSERT into `stock_transactions`.
3. Keep the existing `warehouse_stock_movements` insert (backward compat with any consumers).

No client/types changes required — RPC signature stays identical, history page will start showing entries automatically.

## Out of scope
- IssueItemsDialog already writes to stock_transactions correctly — no change.
- Material Returns / Requests (separate user request if needed).
