
# Plan: Add Bulk QR Code PNG Download

## Overview
Currently, the bulk QR code download only supports PDF format. This plan adds a PNG download option that creates individual PNG files for each selected asset, bundled in a ZIP file for easy download.

## How It Will Work

When you select multiple assets and click "Download QR Codes", the dialog will now show two download options:
1. **Download as PDF** - Current behavior (multi-page PDF, one label per page)
2. **Download as PNG (ZIP)** - New option (individual PNG files in a ZIP archive)

Each PNG will be a 2x1 inch label (600x300 pixels at 300 DPI) matching the existing single-asset QR code format.

---

## Changes Required

### 1. Install JSZip Dependency
Add the `jszip` library to bundle multiple PNG files into a downloadable ZIP archive.

### 2. Create PNG Generation Utility
**New file: `src/utils/bulkQRCodePng.ts`**

Create a utility function that:
- Takes an array of assets
- Generates a 2x1 inch PNG label for each asset (matching the format in `AssetQRCode.tsx`)
- Uses Canvas API to draw QR code on left, Asset ID on right
- Bundles all PNGs into a ZIP file using JSZip
- Returns the ZIP blob for download

### 3. Update BulkQRCodeDialog Component
**File: `src/components/warehouse/BulkQRCodeDialog.tsx`**

Modify the dialog to:
- Add a format selector (PDF vs PNG)
- Add a second download button or dropdown with format options
- Handle both PDF and PNG generation based on user selection
- Update the info text to explain both formats

---

## Technical Details

### PNG Label Format (matches existing AssetQRCode component)
- Dimensions: 600x300 pixels (2x1 inch at 300 DPI)
- QR Code: 280x280 pixels on the left side
- Asset ID: Two-line format (category path on line 1, number on line 2)
- White background with light gray border

### ZIP File Structure
```
asset-qr-codes-2026-01-29.zip
├── qr-FUR_CHA_CH_001.png
├── qr-FUR_CHA_CH_002.png
├── qr-ELE_COM_PC_001.png
└── ...
```

### File Naming
Each PNG is named using the sanitized asset ID (slashes replaced with underscores):
- Example: `FUR/CHA/CH/001` becomes `qr-FUR_CHA_CH_001.png`

---

## Files to Create/Modify

| File | Action |
|------|--------|
| `package.json` | Add `jszip` dependency |
| `src/utils/bulkQRCodePng.ts` | Create - PNG generation logic |
| `src/components/warehouse/BulkQRCodeDialog.tsx` | Modify - Add format selection UI |
