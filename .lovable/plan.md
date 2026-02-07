
# Implementation Plan: Location Reports Analytics

## Overview
Add a comprehensive analytics dashboard for location, sub-location, and department-wise asset reporting to the Warehouse Asset Management module. This replaces the standalone "Reports" button with a dedicated tab featuring interactive charts, KPIs, and Excel export.

## Current State
- **5 tabs** in Asset Management: Assets List, Asset Master, Asset Requests, Analytics, Subcategory Analytics
- **Reports button** in header opens `WarehouseAssetReportDialog` (Excel export only)
- **Existing analytics** use recharts with KPI cards, pie charts, and bar charts

## Changes Summary

| Action | File | Description |
|--------|------|-------------|
| Create | `src/components/warehouse/LocationReportAnalytics.tsx` | New analytics component with charts and filters |
| Modify | `src/pages/warehouse/AssetManagement.tsx` | Add 6th tab, remove Reports button from header |
| Modify | `src/hooks/useWarehouseAssetReport.ts` | Add aggregation functions for analytics |

---

## File 1: LocationReportAnalytics.tsx (NEW)

### Component Structure

```text
+------------------------------------------------------------------+
| Location Reports                                     [Export]    |
+------------------------------------------------------------------+
| [Location-wise] [Sub-Location-wise] [Department-wise]            |
+------------------------------------------------------------------+
| Filters: [Location v] [Sub-Location v] [Department v] [Status v] |
+------------------------------------------------------------------+
| KPI Cards:                                                       |
| [Total Assets] [Total Value] [Top Location] [Avg Value/Location] |
+------------------------------------------------------------------+
| Charts (2x2 Grid):                                               |
| +---------------------------+ +---------------------------+      |
| | Asset Count by Location   | | Value Distribution (Pie)  |      |
| | (Bar Chart)               | |                           |      |
| +---------------------------+ +---------------------------+      |
| +---------------------------+ +---------------------------+      |
| | Status by Location        | | Top 10 by Value          |      |
| | (Stacked Bar)             | | (Horizontal Bar)         |      |
| +---------------------------+ +---------------------------+      |
+------------------------------------------------------------------+
| Detailed Data Table (Collapsible)                                |
+------------------------------------------------------------------+
```

### Key Features
1. **Tab-based report type selection** - Location, Sub-location, Department
2. **Cascading filters** - Sub-location depends on Location, Department depends on Sub-location
3. **Four chart visualizations** using recharts (matching existing patterns)
4. **KPI summary cards** - Total assets, value, top location, utilization
5. **Export to Excel** - Reuses existing `writeExcelFromJSON` utility
6. **Collapsible data table** - Shows detailed breakdown

### Props Interface
```typescript
interface LocationReportAnalyticsProps {
  assets: WarehouseAsset[];
  locations: WarehouseLocation[];
  categories: AssetCategory[];
}
```

### Data Aggregation Logic
- Group assets by location/sublocation/department based on selected tab
- Calculate: asset count, total value, status breakdown, condition breakdown
- Derive: utilization rate, average value per location

---

## File 2: AssetManagement.tsx (MODIFY)

### Changes

1. **Import new component**
```typescript
import { LocationReportAnalytics } from "@/components/warehouse/LocationReportAnalytics";
```

2. **Update TabsList** - Change from 5 columns to 6
```typescript
// Line 867: Change grid-cols-5 to grid-cols-6
<TabsList className="grid w-full grid-cols-6">
```

3. **Add new tab trigger**
```typescript
<TabsTrigger value="location-reports" className="flex items-center gap-2">
  <MapPin className="h-4 w-4" />
  Location Reports
</TabsTrigger>
```

4. **Add new TabsContent**
```typescript
<TabsContent value="location-reports" className="mt-6">
  <LocationReportAnalytics 
    assets={assets}
    locations={locations}
    categories={[...mainCategories, ...mainCategories.flatMap(cat => getSubcategories(cat.id))]}
  />
</TabsContent>
```

5. **Remove Reports button from header** (Lines 442-445)
- Delete the Reports button and related state
- Keep `WarehouseAssetReportDialog` since export functionality will be inside the new component

---

## File 3: useWarehouseAssetReport.ts (MODIFY)

### Add Aggregation Function

```typescript
export interface LocationAnalyticsData {
  locationId: string;
  locationName: string;
  sublocationName?: string;
  departmentName?: string;
  assetCount: number;
  totalValue: number;
  activeCount: number;
  maintenanceCount: number;
  inactiveCount: number;
  disposedCount: number;
  goodCondition: number;
  fairCondition: number;
  poorCondition: number;
}

const fetchAnalytics = async (
  groupBy: 'location' | 'sublocation' | 'department',
  filters: Partial<WarehouseAssetReportFilters>
): Promise<LocationAnalyticsData[]>
```

This function aggregates data for chart visualizations.

---

## Chart Specifications

### 1. Asset Count by Location (Bar Chart)
- X-axis: Location/Sublocation/Department names
- Y-axis: Asset count
- Color: Primary theme color (hsl(217, 91%, 60%))

### 2. Value Distribution (Pie Chart)  
- Segments: Top 8 locations + "Others"
- Labels: Name + percentage
- Colors: COLORS array from existing analytics

### 3. Status Distribution (Stacked Bar)
- X-axis: Location names
- Y-axis: Asset count
- Stacks: Active (green), Maintenance (yellow), Inactive (red), Disposed (gray)

### 4. Top Locations by Value (Horizontal Bar)
- Y-axis: Top 10 location names
- X-axis: Total value
- Sorted descending

---

## Implementation Order

1. **Modify `useWarehouseAssetReport.ts`**
   - Add `fetchAnalytics` function
   - Add `LocationAnalyticsData` interface

2. **Create `LocationReportAnalytics.tsx`**
   - Build component structure with tabs
   - Add cascading filter dropdowns
   - Implement KPI cards
   - Add chart visualizations
   - Add export button
   - Add collapsible data table

3. **Modify `AssetManagement.tsx`**
   - Import new component
   - Change grid to 6 columns
   - Add new tab trigger and content
   - Remove Reports button from header
   - Remove report dialog state (keep dialog for export functionality within new component)

---

## Technical Dependencies
- `recharts` - Already installed (BarChart, PieChart, etc.)
- `@/components/ui/card` - KPI cards
- `@/components/ui/tabs` - Report type selection
- `@/components/ui/select` - Filter dropdowns
- `@/utils/excelUtils` - Excel export
- `date-fns` - Date formatting

---

## Visual Consistency
The new component will follow existing patterns from:
- `AssetAnalytics.tsx` - KPI cards layout, chart styling, color scheme
- `SubcategoryAnalytics.tsx` - Collapsible sections, status/condition breakdowns
- `WarehouseAssetReportDialog.tsx` - Filter logic, cascading dropdowns
