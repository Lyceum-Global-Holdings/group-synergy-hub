

# Plan: Enhanced Location Analytics with Subcategory Details and PDF Export

## Overview
Enhance the **Location Reports** tab within the Analytics & Reports section to include comprehensive subcategory analysis per location, and add PDF export functionality with embedded charts for all report types.

## Current State

| Component | Current Behavior |
|-----------|------------------|
| LocationReportAnalytics | Shows location-wise KPIs, status/condition breakdowns, but no subcategory data |
| UnifiedAssetAnalytics | Has 4 sub-tabs (Overview, Subcategory, Location, Generate Reports) |
| Export | Only Excel export available; no PDF with graphs |

## Requirements

1. Under each location breakdown, show:
   - Total Assets
   - Total Value
   - Utilization
   - Main category breakdown
   - Sub category breakdown and detailed analysis
   - Subcategories by Asset Count
   - Condition Distribution by Subcategory

2. PDF export with graphs included

---

## Solution Architecture

### Part 1: Enhanced Location Data with Subcategory Analysis

**Modify `LocationReportAnalytics.tsx`** to add subcategory data per location:

```text
+------------------------------------------------------------------+
| Location Detailed View (Expanded Row)                             |
+------------------------------------------------------------------+
| Status Breakdown | Condition Breakdown | Value Metrics | Performance|
+------------------------------------------------------------------+
| Main Category Breakdown:                                          |
| [Furniture: 45] [Electronics: 30] [Vehicles: 15]                 |
+------------------------------------------------------------------+
| Subcategory Analysis:                                             |
| | Subcategory    | Count | Value     | Good | Fair | Poor |      |
| | Office Chairs  | 25    | Rs. 50K   | 20   | 3    | 2    |      |
| | Desks          | 20    | Rs. 80K   | 18   | 2    | 0    |      |
+------------------------------------------------------------------+
| Subcategories by Asset Count (Bar Chart)                          |
| Condition Distribution by Subcategory (Stacked Bar)               |
+------------------------------------------------------------------+
```

### Part 2: PDF Export with Charts

Create a new utility `src/utils/locationReportPdfExport.ts` that:

1. Uses `jsPDF` with `jspdf-autotable` (already installed)
2. Generates charts using canvas rendering
3. Embeds chart images in PDF
4. Includes all breakdown data in tables

---

## Files to Create

| File | Purpose |
|------|---------|
| `src/utils/locationReportPdfExport.ts` | PDF generation utility with chart rendering |

## Files to Modify

| File | Changes |
|------|---------|
| `src/components/warehouse/LocationReportAnalytics.tsx` | Add subcategory breakdown per location, add PDF export button |
| `src/components/warehouse/UnifiedAssetAnalytics.tsx` | Pass categories prop to LocationReportAnalytics for subcategory data |

---

## Detailed Implementation

### 1. Enhanced LocationReportAnalytics Data Model

Add subcategory data to the `LocationAnalyticsData` interface:

```typescript
interface LocationAnalyticsData {
  // ... existing fields ...
  
  // NEW: Category breakdown
  categoryBreakdown: {
    categoryId: string;
    categoryName: string;
    assetCount: number;
    totalValue: number;
  }[];
  
  // NEW: Subcategory breakdown
  subcategoryBreakdown: {
    subcategoryId: string;
    subcategoryName: string;
    parentCategoryName: string;
    assetCount: number;
    totalValue: number;
    goodCondition: number;
    fairCondition: number;
    poorCondition: number;
    needsRepair: number;
  }[];
}
```

### 2. Enhanced Expanded Row View

When a location row is expanded, show:

**Section 1: Existing Content** (Status, Condition, Value, Performance)

**Section 2: Main Category Breakdown** (NEW)
- Horizontal list of categories with counts
- Small pie chart showing category distribution

**Section 3: Subcategory Details Table** (NEW)
```text
| Subcategory   | Category   | Assets | Value    | Good | Fair | Poor |
|---------------|------------|--------|----------|------|------|------|
| Office Chairs | Furniture  | 25     | Rs. 50K  | 20   | 3    | 2    |
| Laptops       | Electronics| 15     | Rs. 120K | 12   | 2    | 1    |
```

**Section 4: Subcategory Charts** (NEW)
- Bar chart: Subcategories by Asset Count
- Stacked bar: Condition Distribution by Subcategory

### 3. PDF Export Utility

Create `locationReportPdfExport.ts` with the following structure:

```typescript
// Key functions
export async function exportLocationReportPdf(
  reportData: LocationAnalyticsData[],
  reportType: 'location' | 'sublocation' | 'department',
  kpis: KPIData,
  chartImages: ChartImages
): Promise<void>

// Chart rendering helper (converts recharts to canvas)
async function renderChartToImage(
  chartData: any[],
  chartType: 'bar' | 'pie' | 'stackedBar',
  config: ChartConfig
): Promise<string> // Returns base64 data URL
```

**PDF Structure:**
1. **Header**: Report title, date, filters applied
2. **KPI Summary**: Total Assets, Total Value, Utilization, Top Location
3. **Asset Count Chart**: Bar chart image
4. **Value Distribution Chart**: Pie chart image
5. **Status Distribution Chart**: Stacked bar image
6. **Detailed Table**: All locations with full breakdown

### 4. Chart-to-Image Rendering Approach

Since recharts renders to SVG, we'll use a canvas-based approach:

```typescript
// Create a temporary canvas
const canvas = document.createElement('canvas');
const ctx = canvas.getContext('2d');

// Draw chart manually using canvas API
// For bar charts: draw rectangles
// For pie charts: draw arcs
// Export as base64 image

const imageData = canvas.toDataURL('image/png');
```

This approach avoids external dependencies like html2canvas.

---

## UI Changes

### LocationReportAnalytics Header

**Before:**
```text
| Location Reports                    [Export to Excel] |
```

**After:**
```text
| Location Reports          [Export PDF] [Export Excel] |
```

### Expanded Row Enhancement

**Before (4 columns):**
- Status Breakdown
- Condition Breakdown
- Value Metrics
- Performance

**After (Full Width Sections):**

```text
+------------------------------------------------------------------+
| Row 1: Status | Condition | Value | Performance (existing)       |
+------------------------------------------------------------------+
| Row 2: Main Category Breakdown                                   |
| [Furniture: 45] [Electronics: 30] [Vehicles: 15] [Others: 10]   |
+------------------------------------------------------------------+
| Row 3: Subcategory Analysis                                      |
| Table with: Subcategory | Parent | Count | Value | Condition... |
+------------------------------------------------------------------+
| Row 4: Mini Charts (collapsible)                                 |
| [Subcategory Count Chart] [Condition by Subcategory Chart]      |
+------------------------------------------------------------------+
```

---

## PDF Report Layout

```text
Page 1:
+------------------------------------------------------------------+
| ASSET LOCATION REPORT                           [Company Logo]   |
| Generated: Feb 7, 2026                                           |
+------------------------------------------------------------------+
| Report Type: Location-wise                                       |
| Filters: All Locations | All Statuses                           |
+------------------------------------------------------------------+
| KPI SUMMARY                                                      |
| +------------+ +------------+ +------------+ +------------+      |
| |Total Assets| |Total Value | |Utilization | |Top Location|      |
| |    1,234   | |Rs. 12.5M   | |   85.2%    | | Head Office|      |
| +------------+ +------------+ +------------+ +------------+      |
+------------------------------------------------------------------+
| ASSET DISTRIBUTION BY LOCATION                                   |
| [Bar Chart Image - 500x200px]                                    |
+------------------------------------------------------------------+
| VALUE DISTRIBUTION                                               |
| [Pie Chart Image - 300x200px]                                    |
+------------------------------------------------------------------+

Page 2+:
+------------------------------------------------------------------+
| DETAILED BREAKDOWN                                               |
+------------------------------------------------------------------+
| Location: Head Office                                            |
| Assets: 245 | Value: Rs. 2.5M | Utilization: 88%                |
|                                                                  |
| Main Categories:                                                  |
| Furniture: 120 | Electronics: 80 | Vehicles: 45                 |
|                                                                  |
| Subcategory Analysis:                                            |
| | Subcategory   | Count | Value    | Good | Fair | Poor |       |
| | Office Chairs | 50    | Rs. 500K | 45   | 3    | 2    |       |
| | Desks         | 40    | Rs. 800K | 38   | 2    | 0    |       |
| | Laptops       | 60    | Rs. 1.2M | 55   | 4    | 1    |       |
+------------------------------------------------------------------+
```

---

## Technical Dependencies

| Dependency | Status | Usage |
|------------|--------|-------|
| `jspdf` | Already installed | PDF document creation |
| `jspdf-autotable` | Already installed | Table rendering in PDF |
| Canvas API | Built-in | Chart rendering to images |

---

## Implementation Order

1. **Enhance data aggregation** in `LocationReportAnalytics.tsx`
   - Add category and subcategory breakdown calculation
   - Extend `LocationAnalyticsData` interface

2. **Update expanded row UI**
   - Add category badges row
   - Add subcategory analysis table
   - Add mini charts for subcategory visualization

3. **Create PDF export utility**
   - Build `locationReportPdfExport.ts`
   - Implement canvas-based chart rendering
   - Use jspdf-autotable for tables

4. **Integrate PDF export button**
   - Add button to header
   - Capture chart data for PDF generation

5. **Test all report types**
   - Location-wise PDF with subcategories
   - Sub-location-wise PDF
   - Department-wise PDF

---

## Summary of Changes

| Component | Changes |
|-----------|---------|
| `LocationReportAnalytics.tsx` | Add category/subcategory breakdown per location, enhanced expanded view, PDF export button |
| `locationReportPdfExport.ts` (NEW) | PDF generation with charts and tables |
| Expanded row view | Now includes category badges, subcategory table, condition charts |

This enhancement provides a comprehensive location-based asset analysis with deep drill-down into category and subcategory distributions, exportable as both Excel and PDF with visual charts.

