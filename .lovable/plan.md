
# Plan: Add Location/Sub-Location/Department Analytics with Charts

## Overview
Transform the current Excel-only report functionality into a full analytics dashboard with interactive charts, KPIs, and visual insights for location, sub-location, and department-wise asset distribution.

## Current State
| Component | Purpose |
|-----------|---------|
| `AssetAnalytics.tsx` | General asset analytics with status, condition, category, location charts |
| `SubcategoryAnalytics.tsx` | Detailed subcategory breakdown with hierarchical view |
| `WarehouseAssetReportDialog.tsx` | Excel export only (no visualizations) |

## Proposed Solution
Create a new analytics component `LocationReportAnalytics.tsx` that replaces the Excel-only dialog with a comprehensive analytics view featuring:
- Interactive charts for location/sublocation/department distribution
- Drill-down capability
- Filters with cascading dependencies
- KPI summary cards
- Export functionality

---

## Files to Create

### 1. `src/components/warehouse/LocationReportAnalytics.tsx`
New analytics component with:

**KPI Cards:**
- Total assets across locations
- Total value by location hierarchy
- Top location by asset count
- Utilization metrics

**Charts:**
- **Bar Chart**: Asset count by location/sublocation/department
- **Pie Chart**: Value distribution across selected hierarchy level
- **Stacked Bar Chart**: Status distribution by location
- **Horizontal Bar Chart**: Top 10 locations by asset value

**Features:**
- Tab-based view: Location-wise | Sub-location-wise | Department-wise
- Cascading filter dropdowns (same as report dialog)
- Drill-down from location to sublocation to department
- Export current view to Excel

---

## Files to Modify

### 2. `src/pages/warehouse/AssetManagement.tsx`

**Changes:**
1. Add new tab "Location Reports" in the tabs list
2. Import and render `LocationReportAnalytics` component
3. Remove the "Reports" button from header (functionality moves to tab)
4. Remove `WarehouseAssetReportDialog` import and usage

**Tab Structure After Change:**
```text
[Assets List] [Asset Master] [Asset Requests] [Analytics] [Subcategory Analytics] [Location Reports]
                                                                                    ^^^^^^^^^^^^^^^^
                                                                                    New tab
```

---

## Component Structure

### LocationReportAnalytics.tsx

```text
+------------------------------------------------------------------+
| Location Reports                                                  |
+------------------------------------------------------------------+
| [Location-wise] [Sub-Location-wise] [Department-wise]  [Export]  |
+------------------------------------------------------------------+
| Filters:                                                          |
| Location: [All v]  Sub-Loc: [All v]  Dept: [All v]  Status: [All v]
+------------------------------------------------------------------+
| KPI Cards Row:                                                    |
| [Total Assets] [Total Value] [Top Location] [Avg Value/Location] |
+------------------------------------------------------------------+
| Charts Grid:                                                      |
| +-----------------------------+ +-----------------------------+  |
| |  Asset Count by Location    | |  Value Distribution (Pie)   |  |
| |  (Bar Chart)                | |                             |  |
| +-----------------------------+ +-----------------------------+  |
| +-----------------------------+ +-----------------------------+  |
| |  Status by Location         | |  Top 10 by Value           |  |
| |  (Stacked Bar)              | |  (Horizontal Bar)          |  |
| +-----------------------------+ +-----------------------------+  |
+------------------------------------------------------------------+
| Detailed Table (collapsible):                                     |
| Location | Assets | Value | Active | Maintenance | Good | Fair   |
+------------------------------------------------------------------+
```

---

## Technical Implementation

### Data Processing Logic

```typescript
interface LocationAnalyticsData {
  // For bar charts
  locationDistribution: {
    name: string;
    assetCount: number;
    totalValue: number;
    activeCount: number;
    maintenanceCount: number;
  }[];
  
  // For pie chart
  valueDistribution: {
    name: string;
    value: number;
    color: string;
  }[];
  
  // KPIs
  kpis: {
    totalAssets: number;
    totalValue: number;
    topLocation: string;
    avgValuePerLocation: number;
    utilizationRate: number;
  };
  
  // Detailed data for table/export
  detailedData: {
    location: string;
    sublocation?: string;
    department?: string;
    assetCount: number;
    totalValue: number;
    statusBreakdown: Record<string, number>;
    conditionBreakdown: Record<string, number>;
  }[];
}
```

### Chart Components Used
- `BarChart` from recharts - Asset count distribution
- `PieChart` from recharts - Value distribution  
- `LineChart` from recharts - Trends if applicable
- Custom stacked bar for status breakdown

---

## User Flow

```text
1. User navigates to Asset Management
            |
            v
2. Clicks "Location Reports" tab
            |
            v
3. Sees Location-wise analytics (default)
   - KPI cards with totals
   - Bar chart showing assets per location
   - Pie chart showing value distribution
   - Status breakdown chart
            |
            v
4. User can:
   - Switch to Sub-Location or Department view
   - Apply filters (location, status, condition)
   - Click on chart element for drill-down
   - Export current filtered data to Excel
```

---

## Filter Behavior

| View | Available Filters |
|------|-------------------|
| Location-wise | Status, Condition, Category |
| Sub-Location-wise | Location, Status, Condition, Category |
| Department-wise | Location, Sub-Location, Status, Condition, Category |

Cascading logic:
- Selecting Location enables Sub-Location filter
- Selecting Sub-Location enables Department filter

---

## Charts Specification

### 1. Asset Count by Location (Bar Chart)
- X-axis: Location names
- Y-axis: Asset count
- Color: Primary theme color
- Tooltip: Shows count and percentage

### 2. Value Distribution (Pie Chart)
- Segments: Top 8 locations + "Others"
- Labels: Location name + percentage
- Colors: Theme color palette

### 3. Status Distribution by Location (Stacked Bar)
- X-axis: Location names
- Y-axis: Asset count
- Stacks: Active (green), Maintenance (yellow), Inactive (red), Disposed (gray)

### 4. Top Locations by Value (Horizontal Bar)
- Y-axis: Location names (top 10)
- X-axis: Total value
- Sorted descending

---

## Implementation Order

1. Create `LocationReportAnalytics.tsx` component with:
   - Tab-based report type selection
   - Filter dropdowns
   - KPI cards
   - Charts using recharts
   - Data table with expandable rows
   - Export button

2. Modify `AssetManagement.tsx`:
   - Add new tab for "Location Reports"
   - Import and render new component
   - Keep Reports dialog as backup for quick exports (optional)

3. Update `useWarehouseAssetReport.ts` hook:
   - Add aggregation functions for analytics
   - Return both raw data and aggregated statistics

---

## Dependencies
- `recharts` (already installed)
- `@/components/ui/card`
- `@/components/ui/tabs`
- `@/components/ui/select`
- `@/hooks/useWarehouseAssets`
- `@/hooks/useWarehouseLocations`
- `@/utils/excelUtils`

---

## Benefits
1. Visual insights instead of just Excel exports
2. Interactive drill-down capability
3. Real-time filtering with instant chart updates
4. Consistent with existing analytics patterns (AssetAnalytics, SubcategoryAnalytics)
5. Export still available for detailed reporting needs
