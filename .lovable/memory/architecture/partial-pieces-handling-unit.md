---
name: partial-pieces-handling-unit
description: warehouse_partial_pieces rows are SAP-EWM-style handling units of N identical pieces of one size — record-level total = piece_count × size_value
type: architecture
---

A `warehouse_partial_pieces` row represents N identical pieces of one measured size (SAP EWM Handling Unit / GS1 logistic-unit pattern):

- `piece_count` (int, ≥0, default 1) — current pieces in the group; decremented as pieces are consumed
- `original_piece_count` (int, ≥1, default 1) — captured at creation, immutable
- `size_value` × `piece_count` = total measured quantity in `size_uom`

Rules:
- Each record stays uniform — different sizes ⇒ different rows.
- Consume via `consume_partial_piece_pieces(p_id, p_pieces, p_residual_size, p_reason, …)`:
  - Decrement whole pieces first.
  - If `p_residual_size > 0`, peel a smaller remnant row from the last consumed piece (group's `piece_count` drops by an extra 1; new 1-piece row holds `size_value - residual`).
  - Stock ledger debit = `p_pieces × size_value + p_residual_size` (base measure) and `-p_pieces` secondary count.
- Legacy `consume_partial_piece(p_id, p_quantity, …)` is retained for back-compat (treats the row as 1-piece).
- Bulk-import CSV column `quantity` (or `piece_count`) seeds the group size; default 1.

UI: Add Partial Piece dialog captures Size + Qty (single + bulk tab); list shows `qty × size = total` per row; CSV exports include `quantity` and `total_size`.
