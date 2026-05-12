# Resize Bin Allocation QR Labels

## Goal
Change the downloadable bin-allocation QR PDF so each label is **102 × 51 mm** outer (page/border) with a **96 × 48 mm** printable content area inside — i.e. a uniform **3 mm border margin** on all sides (102−96 = 6 → 3 mm/side; 51−48 = 3 → 1.5 mm/side).

To keep the border equal on all sides and match the user's "border 102×51, content 96×48" request literally, the cleanest interpretation is a symmetric **3 mm margin** between page edge and the inner content rectangle. The page itself is the 102×51 mm sheet; the printed border line sits at the inner rectangle.

## Standards applied
- **ISO/IEC 18004** — QR Code symbology, ECC level M (~15% recovery), quiet zone ≥ 4 modules.
- **ISO/IEC 15415** — print quality: keep margin ≥ 4 modules (the `margin: 4` qrcode option).
- **GS1 Digital Link** — payload format already produced by `buildBinQRPayload` (no change).
- **ISO 216 / label trade practice** — sizes specified in millimetres, landscape orientation, symmetric margins for die-cut tolerance.

## Layout (mm, landscape 102 × 51)

```text
┌────────────────────────────────────────────────────┐  page 102 × 51
│  ┌──────────────────────────────────────────────┐  │  border at 3mm inset
│  │ ┌──────────┐  ITEM_CODE                      │  │  → inner 96 × 48
│  │ │          │  Item name (truncated)          │  │
│  │ │   QR     │  Bin: BIN_CODE                  │  │
│  │ │  45×45   │  Loc: LOCATION_CODE             │  │
│  │ └──────────┘                                 │  │
│  └──────────────────────────────────────────────┘  │
└────────────────────────────────────────────────────┘
```

- QR module: 45 × 45 mm, positioned at x=4.5, y=3 mm (1.5 mm gap inside the border).
- Text column starts at x≈53 mm; rows at y≈14 / 24 / 32 / 40 mm.
- Font sizes: item code 11 pt bold mono (Courier), name 9 pt, bin/loc 8 pt.
- Border: 0.3 mm stroke at the 96×48 inner rectangle (3 mm inset from page edge).
- Background: white fill across full page.

## Technical changes

Single file: `src/utils/bulkBinQRCodePdf.ts`

1. `new jsPDF({ orientation: 'landscape', unit: 'mm', format: [102, 51] })` (was inches, 2×1).
2. `doc.addPage([102, 51], 'landscape')` for subsequent allocations.
3. Replace all coordinates with the mm values above.
4. Bump `QRCode.toDataURL` width to ~600 px and `margin: 4` (ISO/IEC 15415 quiet zone). ECC stays `'M'`.
5. Add a `Loc:` line so the location/sub-location code is visible on the label (the tab already shows the full path; the QR itself still resolves to it via GS1 Digital Link).
6. Adjust `truncate` call sites for the wider text column (item code ≤ 18, name ≤ 28, bin ≤ 22, loc ≤ 22).

No changes to:
- `BinAllocationsTab.tsx` (it just calls `generateBulkBinQRCodePdf` / `downloadBulkBinQRCodePdf`).
- `buildBinQRPayload` (GS1 Digital Link payload unchanged).
- Public resolver page or the `/b/:id` route.
- Any DB / RLS / hook code.

## Out of scope
- Asset (non-bin) QR PDF in `bulkQRCodePdf.ts` — separate label stock, not requested.
- PNG export (`bulkQRCodePng.ts`) — separate format.
- Print preview UI changes.
