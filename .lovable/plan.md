## Goal

On bin-allocation QR stickers (both bulk PDF and individual PNG download), drop the `Item:`, `Name:`, `Bin:` labels and render the values only. Make the item code and item name visibly larger; keep the bin value present but smaller/secondary.

## Files

1. **`src/utils/bulkBinQRCodePdf.ts`** (bulk 96×48 mm PDF)
2. **`src/components/warehouse/BinAllocationQRDialog.tsx`** (individual 2"×1" PNG)

## Bulk PDF changes (`bulkBinQRCodePdf.ts`)

- Remove `key` from rendering — render value-only blocks.
- Update `Block` shape: drop `key`; render value with `splitTextToSize` across full text-column width (`textRight - textX`).
- New typography hierarchy (start sizes, ISO 15416 ≥6.5 pt floor):
  - Item code: Courier bold, **14 pt** (floor 9 pt)
  - Item name: Helvetica normal, **11 pt** (floor 7.5 pt)
  - Bin code: Helvetica bold, **9 pt** (floor 7 pt)  ← unchanged in role, kept as supporting line
- Adaptive shrink loop unchanged (uniform −0.5 pt until fits or floors hit), then ellipsise last visible line of last block if still overflowing.
- Slightly increase `BLOCK_GAP` (1.2 → 1.6 mm) so the larger type breathes.

## Individual PNG changes (`BinAllocationQRDialog.tsx`)

In `handleDownload` canvas composition (600×300 @ 300 dpi):
- Drop `Bin: ` prefix; render bin value alone.
- Resize text:
  - Item code: `bold 40px "Courier New", monospace` (was 28 px), wrap to 2 lines if needed using a small word/char-wrap helper.
  - Item name: `28px Helvetica, Arial, sans-serif` (was 20 px), wrap to up to 2 lines.
  - Bin: `22px bold Helvetica, Arial, sans-serif` (was 20 px normal with prefix).
- Vertical layout recomputed top-down from `PAD` with line heights matching font size × 1.15; ellipsise last line of each block if it still exceeds the text column.
- Keep existing `truncateForCanvas` as the per-line ellipsis helper; add a tiny `wrapLines(ctx, text, maxWidth, maxLines)` helper for multi-line wrapping.

## Out of scope

- QR payload, dialog metadata panel (`Item: code — name` summary stays as-is for screen reading), routes, RPC, RLS, or `binQRPayload.ts`.
- The asset (non-bin) bulk QR generator in `bulkQRCodePdf.ts`.

## Standards

- ISO/IEC 18004 (QR, ECC M) and ISO/IEC 15415/15416 (HRI minimum size, quiet zone) preserved.
- GS1 Gen Specs §4.14: HRI uses monospace for the identifier (item code) and proportional for descriptive text — labels are optional and removed here for density.
