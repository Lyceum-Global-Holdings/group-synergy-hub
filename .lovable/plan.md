## Goal
Update bulk bin-QR labels (102×51 mm with 96×48 mm bordered content) to drop the Quantity line and instead always show the **full** Item Code, **full** Item Name, and **full** Bin code, wrapping across multiple lines when they exceed the available text-column width.

## Scope
Single file: `src/utils/bulkBinQRCodePdf.ts`. No changes to payload (`binQRPayload.ts`), single-label flow, RPC, RLS, or UI.

## Label layout (unchanged geometry)
- Page: 102 × 51 mm landscape, 1.5 mm vertical / 3 mm horizontal margins → 96 × 48 mm inner content with a 0.3 mm border.
- QR: 45 × 45 mm, vertically centred on the left (ISO/IEC 18004, ECC level M, 4-module quiet zone per ISO/IEC 15415).
- Text column: starts at ~52.5 mm, width ≈ 46 mm available to the inner border.

## Text content rules
1. **Remove** the `Qty:` line entirely (and the `allocated_quantity` rendering).
2. Render three labelled blocks in this order, each wrapping to multiple lines as needed:
   - `Item:` — full `item_code` (Courier bold 10 pt for scanability; GS1 General Specifications recommend mono for human-readable interpretation/HRI).
   - `Name:` — full `item_name` (Helvetica 8.5 pt).
   - `Bin:` — full `bin_code` (Helvetica bold 9 pt).
3. **No truncation.** Use `jsPDF.splitTextToSize(value, maxWidth)` to wrap long values. The label key (`Item:` / `Name:` / `Bin:`) is printed once on the first wrapped line; continuation lines are indented to the value column.
4. **Location line is dropped** to free vertical space (location is already encoded in the GS1 Digital Link payload and visible after scanning); this keeps the label readable when item names or bin paths are long. Confirm in the question below if you'd prefer to keep it.

## Vertical fit strategy
- Available text height ≈ 45 mm (inner 48 mm minus 1.5 mm top/bottom padding).
- Line heights: Item 4.4 mm, Name 3.6 mm, Bin 4.0 mm; 1.5 mm gap between blocks.
- Worst-case budget: Item 2 lines + Name 4 lines + Bin 2 lines ≈ 35 mm, fits comfortably.
- If a value still overflows the remaining height, progressively shrink that block's font size by 0.5 pt (down to a 6.5 pt floor, ISO 15416 minimum legible HRI), then as a last resort ellipsise the **last visible line only** so the QR (which carries the canonical data) remains the source of truth.

## Standards referenced
- ISO/IEC 18004 (QR symbology, ECC M ≈ 15% recovery)
- ISO/IEC 15415 / 15416 (print quality, quiet zone, HRI legibility)
- GS1 General Specifications §4.14 (HRI rendering: monospace for code, mixed case for descriptive text)
- GS1 Digital Link (payload format, unchanged)

## Out of scope
- Single-allocation download path
- Payload structure
- Any DB / RPC / RLS / route changes
