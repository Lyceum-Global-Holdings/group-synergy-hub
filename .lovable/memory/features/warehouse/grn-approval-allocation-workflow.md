---
name: GRN Approval & Bin Allocation
description: Quarantine-on-receipt GRN flow; inventory rows + bin allocations created only inside approve_grn_with_allocations RPC
type: feature
---

ISO 9001 §8.6 GR-Blocked-Stock / SAP MIGO model.

**Invariants:**
- No per-company `warehouse_items` row is provisioned while a GRN is in draft/submitted state. The CreateGrnDialog item picker stores `catalog_item_id` only; auto-resolve in GrnBinAllocationDialog only looks up existing rows.
- GRN approval MUST go through `approve_grn_with_allocations(p_grn_id, p_allocations jsonb)`. A guard trigger `enforce_grn_allocation_on_approval` blocks any other path (raises ISO 9001 §8.6 error).
- The RPC: validates admin + status `submitted/draft`, resolves missing `warehouse_item_id` via `ensure_warehouse_item_for_company` (using `catalog_item_id` then `item_code`), requires Σ allocations per good-quality line == `quantity_received`, upserts `warehouse_bin_allocations` FIRST, then inserts `stock_transactions` (ledger trigger recomputes qty_before/after from live allocations), then flips status to approved. Existing `update_stock_on_grn_approval` trigger updates `current_stock`.
- Rejection flow (`reject_goods_receipt_note`) is independent and unchanged.
- `grn_items.catalog_item_id` (nullable, FK to `warehouse_item_catalog`) carries the catalog link until approval.
