
## Problem

Today each `warehouse_partial_pieces` row represents **exactly one** physical piece of a given `size_value` + `size_uom`. If a user has 5 identical 2.30 m offcuts, they must create 5 rows (or use bulk mode and type 5 lines). The Add dialog only captures `size`, never quantity.

## International standard we follow

Aligning with **SAP EWM Handling Units**, **Oracle WMS Catch-Weight / Dual-UOM**, and **GS1 Logistic Unit (SSCC) variable-measure** semantics:

- A partial-piece record is a **handling group** of `N` identical pieces.
- Each piece has a measured size in the size UOM (the "variable measure" / catch quantity).
- The base-UOM stock value = `piece_count × size_value` (converted to base UOM where applicable). This stays consistent with the existing dual-quantity-tracking memo (base UOM is canonical for valuation/FIFO; the secondary count is informational).
- Consumption, reservation, scrap and split operate on **whole pieces first**, then on the residual size of the last piece (matches EWM "partial consumption of an HU").

## Scope of change

### 1. Data model (single migration)

Add to `warehouse_partial_pieces`:

| Column | Type | Notes |
|---|---|---|
| `piece_count` | `integer NOT NULL DEFAULT 1 CHECK (piece_count >= 1)` | identical pieces in this record |
| `original_piece_count` | `integer NOT NULL DEFAULT 1` | captured at creation, never mutated |

Backfill: `piece_count = 1`, `original_piece_count = 1` for all existing rows (current behaviour preserved exactly).

Generated helper view column (optional) `total_size_value = piece_count * size_value` exposed by `list_partial_pieces` for UI display only.

### 2. RPCs (same migration)

- `create_partial_piece` payload accepts `piece_count` (default 1). When > 1, generated `piece_code` becomes `…/PQ-NNNN` for the group and individual labels get a `#k` suffix only if the user opts in.
- `bulk_create_partial_pieces`: each row accepts `piece_count`.
- `issue_partial_quantity(p_piece_id, p_pieces, p_residual_size, …)` — new signature:
  - Decrement `piece_count` by `p_pieces` (whole pieces consumed).
  - If `p_residual_size > 0`, also reduce the **last** remaining piece's `size_value` by that residual (creates a smaller successor row, original group moved to `consumed` when `piece_count` hits 0).
  - Keeps existing single-piece behaviour when caller passes `piece_count = 1` (back-compat shim retained for one release).
- `split_partial_piece`: unchanged for size split; new `split_group_off(p_piece_id, p_pieces_to_split_off)` to peel `k` pieces into a new record (common EWM "HU split").
- `list_partial_pieces` returns `piece_count`, `original_piece_count`, `total_size_value`.

Stock-ledger writes use `quantity_change = -(p_pieces × size_value + p_residual_size)` in base UOM and `secondary_quantity_change = -p_pieces` so the ledger continues to satisfy the `stock-ledger-immutable-balances` rule.

### 3. UI — `AddPartialPieceDialog`

Single tab gains a **Qty (pieces)** input next to **Size**:

```text
Size *           Qty *           UOM *
[  2.30  ]       [   5  ]        [  m  ▾]
                 → Total: 11.50 m (5 × 2.30 m)
```

- `Qty` default `1`, min `1`, integer.
- Live total preview under the inputs.
- Piece-code hint becomes `…/PQ-NNNN` (group code) plus a checkbox **"Generate individual piece codes (#1…#N)"** for users who need per-piece traceability.

Bulk tab gets a new **Qty** column between Size and Piece code; running total at the top becomes `Σ qty pieces · Σ (qty×size) {uom}`.

### 4. Consume / Issue dialog

`ConsumePartialPieceDialog` switches from "enter quantity ≤ size" to a two-field UX:

```text
Pieces to consume: [  2  ] of 5      Residual size on last piece: [ 0.00 ] m
Total consumed: 4.60 m
```

Validation: `0 ≤ pieces ≤ piece_count`; residual only allowed when `pieces < piece_count`; `0 ≤ residual < size_value`.

### 5. Lists & exports

- `PartialQuantities` table shows new **Qty** column and **Total size** (computed).
- Bulk-import CSV template (`importTemplate.ts`) gains optional `quantity` column (default 1).
- `partial-pieces-item-master-sync` memory unchanged (still about UOM/cost propagation).

## Out of scope

- Mixed-size groups (each record still = identical pieces). Different sizes still mean different rows.
- Per-piece serial numbers / GS1 SSCC printing — separate request.
- Retro-grouping of existing single-piece records.

## Files touched

- `supabase/migrations/<ts>_partial_pieces_qty.sql` (schema + RPCs)
- `src/types/partialPiece.ts` (add `piece_count`, `original_piece_count`, `total_size_value`)
- `src/components/warehouse/partial-qty/AddPartialPieceDialog.tsx` (Qty input + bulk column + totals)
- `src/components/warehouse/partial-qty/ConsumePartialPieceDialog.tsx` (pieces + residual)
- `src/components/warehouse/partial-qty/importTemplate.ts` (CSV column)
- `src/hooks/warehouse/usePartialPieces.ts` (payload + types)
- `src/pages/warehouse/PartialQuantities.tsx` (Qty + Total columns)
- `.lovable/memory/architecture/partial-pieces-handling-unit.md` (new memo) + index update

## Acceptance

- Creating "Size 2.30 m, Qty 5" produces one row with `piece_count=5`, `total_size_value=11.50 m`.
- Issuing 2 pieces leaves `piece_count=3`, ledger entry `-4.60 m / -2 pcs`.
- Issuing 5 pieces moves the row to `consumed`.
- Existing rows continue to behave identically (qty=1).
