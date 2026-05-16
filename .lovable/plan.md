## Goal

Let users issue from a partial-piece handling unit by either:
- **Quantity mode** (current): whole pieces + optional residual on the last piece, or
- **Size mode** (new): enter a target measure in `size_uom`; the system allocates whole pieces first and peels a residual from the last piece automatically.

This mirrors SAP EWM "consume by HU count" vs. "consume by base UoM" and GS1 CBV variable-measure handling.

## UX (ConsumePartialPieceDialog)

Add a segmented control at the top: **By pieces** | **By size**.

- **By pieces** — unchanged (pieces + optional residual, live total preview).
- **By size** — single input "Quantity to issue" in `size_uom`, with live derived preview:
  - `pieces = floor(qty / size_value)` (capped at `piece_count`)
  - `residual = qty - pieces * size_value`
  - If `pieces == piece_count` and `residual > 0` → error "Exceeds available (max = N × size = total)".
  - Preview: "Will consume **3 pcs × 6 m + 1.5 m residual = 19.5 m** (remnant of 4.5 m left)".

Shared fields below: reason, post-to-stock, reference, notes. Submit always calls the same RPC with the resolved `(pieces, residual_size)` — server stays the single source of truth, no new RPC needed.

## Validation

- Size mode: `0 < qty ≤ piece_count × size_value`.
- Reject sizes that would require splitting more than one piece (only the last piece may have a residual), which is automatically satisfied by the floor/mod derivation.
- Round qty input to 3 decimals (`parseQty` from `src/lib/quantityInput.ts`).

## Files to edit

- `src/components/warehouse/partial-qty/ConsumePartialPieceDialog.tsx` — add mode toggle, size input, derivation + preview, validation.

No DB / RPC / hook / type changes. No memory update needed (handling-unit memo already covers semantics).

## Out of scope

- Multi-row picking across multiple handling units (FIFO across pieces) — separate feature.
- Cross-UoM conversion (e.g. issuing in mm when size_uom is m).
