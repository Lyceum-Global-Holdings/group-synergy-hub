
# Plan: Fix Print Preview for QR Code Labels

## Problem Identified
The print preview is showing a blank page because:
1. The print CSS uses `.print-root` class selector, but this class is never applied to any element
2. The print preview dialog is nested inside another dialog (`BulkQRCodeDialog`), causing print context issues
3. The visibility/display rules conflict with the dialog's styling

## Solution Approach
Change the print approach to use a **new browser window** instead of trying to print within the existing dialog. This is more reliable because:
- Avoids nested dialog CSS conflicts
- Provides a clean print context
- Matches how other printing features work (like GrnDocument)

## Changes Required

### 1. Update Print Preview Component
**File: `src/components/warehouse/BulkQRCodePrintPreview.tsx`**

Instead of using `window.print()` within the dialog, open a new popup window with the labels:

**Current approach (broken):**
```text
Dialog opens → Labels render in dialog → window.print() → Blank page
```

**New approach:**
```text
Dialog opens → Labels generate → Open new window with labels → window.print() in that window
```

Changes:
- Open labels in a new browser window/popup dedicated for printing
- Use inline styles in the popup HTML so print CSS is self-contained
- The new window will be print-optimized with proper visibility
- Auto-trigger print dialog in the new window
- Close parent dialog after print is triggered

### 2. Simplified Print Window Structure
The new print window will contain:
- A simple HTML page with the QR label images in a grid
- Inline CSS for both screen preview and print layout
- Auto-print trigger on load
- A manual print button as fallback

### 3. Alternative: Fix Existing Dialog Print
If we keep the current dialog approach, we need to:
- Add a unique class like `qr-print-preview` to the label container
- Use the same visibility pattern as GrnDocument (hide all, show specific)
- Ensure the dialog content is positioned correctly for print

## Recommended Implementation
Use the **new window approach** as it's more reliable:

```typescript
// Open dedicated print window
const printWindow = window.open('', '_blank');
printWindow.document.write(`
  <html>
  <head>
    <title>QR Labels</title>
    <style>
      /* Grid layout for labels */
      .label-grid {
        display: grid;
        grid-template-columns: repeat(2, 2in);
        gap: 0.25in;
        padding: 0.5in;
        justify-content: center;
      }
      .label-item {
        width: 2in;
        height: 1in;
        page-break-inside: avoid;
      }
      @media print {
        .no-print { display: none; }
      }
    </style>
  </head>
  <body>
    <button class="no-print" onclick="window.print()">Print</button>
    <div class="label-grid">
      ${labels.map(url => `<img src="${url}" class="label-item"/>`).join('')}
    </div>
    <script>window.onload = () => window.print();</script>
  </body>
  </html>
`);
printWindow.document.close();
```

## Files to Modify

| File | Action |
|------|--------|
| `src/components/warehouse/BulkQRCodePrintPreview.tsx` | Rewrite to use new window approach |
| `src/components/warehouse/BulkQRCodeDialog.tsx` | Minor updates to handle the new print flow |

## Technical Details

### Print Window Features
- Opens as a popup window focused for printing
- Contains only the label grid and print controls
- Auto-triggers browser print dialog on load
- Falls back to manual print button if auto-print is blocked
- Clean, isolated CSS that won't conflict with the main app

### Label Grid Layout
- 2 columns of 2x1 inch labels
- 0.25 inch gap between labels
- 0.5 inch page margins
- Automatic page breaks between full pages
- 10 labels per A4 page (2 columns x 5 rows)

### User Flow After Fix
1. User selects assets and clicks "Download QR Codes"
2. User selects "Print Directly" option
3. User clicks "Print Labels" button
4. New window opens showing all labels in a grid
5. Browser print dialog appears automatically
6. User adjusts printer settings and prints
