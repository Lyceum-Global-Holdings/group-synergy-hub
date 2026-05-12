## Goal
Increase the **item name** font size in bin-allocation QR labels (both bulk PDF and individual PNG). Item code and bin code stay as they are.

## Bulk PDF — `src/utils/bulkBinQRCodePdf.ts`
- Bump item-name `startSize` from `11` → `13` pt.
- Raise `FLOOR.name` from `7.5` → `9.0` pt so it stays visibly larger after any uniform shrink.
- Wrapping/ellipsise behaviour unchanged.

## Individual PNG — `src/components/warehouse/BinAllocationQRDialog.tsx`
- Bump item-name font from `28px` Helvetica → `34px` Helvetica.
- Keep `maxLines: 2` and existing wrap/ellipsise/centring logic; recompute `totalH` already handles the new size.

## Out of scope
QR payload, item-code sizing, bin-code sizing, asset (non-bin) QR generator, dialog metadata panel.

## Standards preserved
ISO/IEC 18004 (QR, ECC M), ISO/IEC 15415/15416 (HRI legibility, quiet zone), GS1 Gen Specs §4.14.