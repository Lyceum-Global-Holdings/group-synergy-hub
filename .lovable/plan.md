
# Fix: Asset Detail PDF Export - Proper Structured PDF Instead of Image

## Problem

The per-location "PDF" button in the expanded asset detail section (lines 1348-1357) calls `handleCaptureAsPdf`, which uses `html2canvas` to take a screenshot of the HTML and embed it as a single image in the PDF. This results in:
- Blurry or unreadable text at certain zoom levels
- No text selectability or searchability
- Poor scaling on different paper sizes
- Charts rendered as raster images instead of data tables

## Solution

Replace the `handleCaptureAsPdf` function with a proper structured PDF generator using `jsPDF` + `jspdf-autotable` (already installed and used by `exportLocationReportPdf`). The new function will generate a professional report with:

1. **Header** -- Location name, report type badge, parent info, generation date
2. **KPI Summary Grid** -- Assets count, Total Value, Active count, Utilization rate
3. **Status Breakdown Table** -- Active, Maintenance, Inactive, Disposed counts
4. **Condition Breakdown Table** -- Good, Fair, Poor, Needs Repair counts
5. **Value Metrics** -- Total Value, Average Value per asset
6. **Main Category Breakdown Table** -- Category name and asset count
7. **Subcategory Analysis Table** -- Subcategory, Parent Category, Assets, Value, Good, Fair, Poor
8. **Asset Master Items Table** -- Item Name, Brand, Category, Subcategory, Count, Value, Good, Fair, Poor

All rendered as native PDF text and tables (not images), with proper page breaks, headers, and footers.

## File Changes

### `src/components/warehouse/LocationReportAnalytics.tsx`

Replace the `handleCaptureAsPdf` function (lines 180-267) with a new implementation that:
- Removes the `html2canvas` dependency for this function
- Creates a `jsPDF` document directly
- Uses `autoTable` for all tabular data
- Builds structured sections matching the expanded detail view
- Uses the `item` data (which contains `categoryBreakdown`, `subcategoryBreakdown`, `assetMasterBreakdown`) already available in the component

The data is already computed and available in the `analyticsData.sortedByCount` array -- each item has all the breakdown data needed. No new data fetching is required.

### Technical Approach

```text
handleCaptureAsPdf(locationId, locationName):
  1. Find the item from analyticsData.sortedByCount by locationId
  2. Create jsPDF document (A4 portrait)
  3. Add header: title, report type, date
  4. Add KPI summary table (autoTable, 2x2 grid)
  5. Add status + condition breakdown table
  6. Add category badges as a comma-separated row
  7. Add subcategory analysis table (all rows, not limited to 8)
  8. Add asset master items table (all rows, not limited to 10)
  9. Add page numbers and footer
  10. Save as PDF
```

No new files needed. No new dependencies. The existing `jspdf` and `jspdf-autotable` packages are already used elsewhere in the project.
