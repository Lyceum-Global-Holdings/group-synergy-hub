

# Fix Sub-Location Report PDF Export: Structured Tables + Location Codes

## Problems Identified

1. **Stretched charts in PDF**: The `exportLocationReportPdf` function renders charts as canvas images (`renderChartToImage`) and embeds them as PNGs in the PDF. These images get stretched/distorted when scaled to fit the PDF page.

2. **"Asset Count by Sub-Location" not using location codes**: The `handleExportPdf` function passes `loc.name` for all chart data instead of `loc.locationCode || loc.name`.

3. **Charts in the global PDF export are image-based**: All three charts (Asset Count bar, Value Distribution pie, Status stacked bar) are rendered via canvas and added as images, causing quality and stretching issues.

## Solution

Replace all canvas-rendered chart images in the PDF with structured jsPDF-autoTable tables, and use location codes where available.

### File 1: `src/components/warehouse/LocationReportAnalytics.tsx`

**Update `handleExportPdf` chart data (lines 960-975)** to use location codes:

```typescript
assetCountData: analyticsData.sortedByCount.slice(0, 10).map((loc) => ({
  name: loc.locationCode || loc.name,
  value: loc.assetCount,
})),
valueDistribution: analyticsData.valueDistribution.map((loc) => ({
  name: loc.name,  // already uses locationCode from earlier fix
  value: loc.value,
})),
statusDistribution: analyticsData.statusByLocation.map((loc) => ({
  name: loc.name,  // already uses locationCode from earlier fix
  active: loc.Active,
  maintenance: loc.Maintenance,
  inactive: loc.Inactive,
})),
```

### File 2: `src/utils/locationReportPdfExport.ts`

**Replace canvas chart rendering with autoTable structured data** on pages 1-2:

1. **Asset Count Bar Chart (lines 553-571)**: Replace `renderChartToImage("bar", ...)` and `doc.addImage(...)` with an autoTable showing Location | Asset Count, sorted descending.

2. **Value Distribution Pie Chart (lines 577-587)**: Replace `renderChartToImage("pie", ...)` with an autoTable showing Location | Value | Percentage of total.

3. **Status Distribution Chart (lines 595-603)**: Replace `renderChartToImage("stackedBar", ...)` with an autoTable showing Location | Active | Maintenance | Inactive | Total.

4. **Remove the canvas rendering functions** (`drawBarChart`, `drawPieChart`, `drawStackedBarChart`, `drawSubcategoryConditionChart`, `renderChartToImage`) as they will no longer be needed.

## Result

- PDF exports will contain clean, structured tables instead of stretched chart images
- All location labels in the PDF will use location codes when available
- File sizes will be smaller and rendering will be faster without canvas operations

