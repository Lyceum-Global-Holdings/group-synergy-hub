## Goal
Force the **item code** to render as a single line (no wrapping) in both bulk PDF and individual PNG bin QR labels. Item name and bin can still wrap as today.

## Bulk PDF — `src/utils/bulkBinQRCodePdf.ts`
- Add a per-block `singleLine: boolean` flag on `Block`. Set `true` on the item-code block only.
- In `computeLayout` and `renderTextBlocks`, for single-line blocks:
  - Skip `splitTextToSize`; treat as exactly 1 line.
  - At the chosen font size, if `doc.getTextWidth(value) > valMaxW`, shrink that block's font further (independent of the uniform shrink loop) down to its `FLOOR.item` (9.0 pt).
  - If still wider than the column at the floor, ellipsise with existing `ellipsiseToWidth` so it stays one line.
- Keep the existing uniform shrink loop for vertical fit; single-line block contributes `lh × 1` to total height.
- Item name and bin keep current multi-line wrap + ellipsise behaviour.

## Individual PNG — `src/components/warehouse/BinAllocationQRDialog.tsx`
- Change the item-code block to `maxLines: 1`.
- Before render, auto-shrink the item-code font from 40 px down to a floor of 24 px (≈ ISO 15416 HRI minimum at 300 dpi for 2"×1" label) until `ctx.measureText(itemCode).width <= textMaxW`.
- If still overflowing at the floor, single-line ellipsise via existing `truncateForCanvas`.
- Item name (`maxLines: 2`) and bin (`maxLines: 1`) unchanged.
- Recompute `wrapped`/`totalH` after the shrink so vertical centring stays correct.

## Out of scope
QR payload, dialog metadata panel, routes/RPC/RLS, `binQRPayload.ts`, asset/non-bin bulk QR generator (`bulkQRCodePdf.ts`).

## Standards preserved
ISO/IEC 18004 (QR, ECC M), ISO/IEC 15415/15416 (HRI minimum size, quiet zone), GS1 Gen Specs §4.14 (monospace identifier, proportional descriptive text).