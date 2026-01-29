
# Plan: Add Direct Print Function for Asset QR Codes

## Overview
Add a new "Print QR Codes" option that renders QR code labels as images directly in the browser and triggers the print dialog. This bypasses PDF generation issues by using HTML/CSS-based print layouts with embedded image labels.

## How It Will Work

When you select assets and click "Download QR Codes", the dialog will now show three options:
1. **PDF Document** - Existing behavior
2. **PNG Images (ZIP)** - Existing behavior  
3. **Print Directly** - New option that opens a print-ready view with QR labels rendered as images

Clicking "Print" will:
1. Generate all QR labels as PNG images (reusing the existing Canvas-based logic)
2. Open a new print preview dialog with labels laid out in a grid
3. Trigger the browser's print dialog with optimized CSS for label printing

---

## Changes Required

### 1. Create Print Preview Component
**New file: `src/components/warehouse/BulkQRCodePrintPreview.tsx`**

A dedicated component that:
- Accepts an array of assets
- Generates PNG labels for each asset using Canvas API (reusing logic from `bulkQRCodePng.ts`)
- Displays labels in a print-optimized grid layout (multiple labels per page)
- Includes print-specific CSS to hide UI controls and format for label sheets
- Provides a print button that triggers `window.print()`

### 2. Create Print Utility Function
**New file: `src/utils/printQRCodeLabels.ts`**

Export a function that:
- Takes an array of assets
- Generates image data URLs for each QR label
- Returns an array of data URLs for rendering in the print preview

### 3. Update BulkQRCodeDialog
**File: `src/components/warehouse/BulkQRCodeDialog.tsx`**

Modify to:
- Add "Print Directly" as a third format option in the radio group
- Handle the print format by opening the print preview dialog
- Add a Printer icon for the print option

---

## Technical Details

### Print Layout
- **Page size**: A4 (default) with options for label sheets
- **Labels per page**: 2x5 grid (10 labels per A4 page) or custom
- **Each label**: 2x1 inch (matching existing format)
- **Print CSS**: Hide all UI except the label grid, set proper margins

### Label Generation Flow
```text
User selects assets → Opens dialog → Selects "Print Directly" 
    → Clicks Print → Generates all PNG labels as data URLs
    → Opens print preview with labels in grid → Triggers window.print()
```

### Print CSS Strategy
Use `@media print` rules to:
- Hide the dialog chrome and navigation
- Show only the label grid
- Set page breaks between full pages of labels
- Use exact dimensions for accurate printing

---

## User Experience

1. Select multiple assets using checkboxes in the Assets List
2. Click "Download QR Codes" button in the bulk action toolbar
3. In the dialog, select "Print Directly" format option
4. Click "Print" button
5. Browser print preview opens showing all QR labels in a grid
6. User adjusts printer settings and clicks Print

---

## Files to Create/Modify

| File | Action | Purpose |
|------|--------|---------|
| `src/utils/printQRCodeLabels.ts` | Create | Generate label images as data URLs |
| `src/components/warehouse/BulkQRCodePrintPreview.tsx` | Create | Print-optimized label display component |
| `src/components/warehouse/BulkQRCodeDialog.tsx` | Modify | Add print option to format selector |

---

## Technical Implementation Notes

### Reusing Existing Canvas Logic
The `generateSinglePngLabel` function in `bulkQRCodePng.ts` already generates perfect 600x300px labels. We'll create a variant that returns a data URL instead of a Blob for direct rendering in `<img>` tags.

### Print Preview Component Structure
```text
BulkQRCodePrintPreview
├── Print controls (hidden during print)
│   ├── Print button
│   └── Close button
└── Print area (visible during print)
    └── Label grid
        ├── Label 1 (img with data URL)
        ├── Label 2
        └── ... (all selected assets)
```

### Print CSS Example
```css
@media print {
  .print-controls { display: none; }
  .print-area { 
    position: absolute;
    left: 0; top: 0;
    width: 100%;
  }
  .label-grid {
    display: grid;
    grid-template-columns: repeat(2, 2in);
    gap: 0.25in;
  }
  .label-item {
    width: 2in;
    height: 1in;
    page-break-inside: avoid;
  }
}
```
