

# Plan: Consolidate Analytics with Report Generation

## Overview
Merge the three separate analytics tabs (Analytics, Subcategory Analytics, Location Reports) into a single unified **"Analytics & Reports"** tab. This consolidated view will include sub-tabs for different report types, each with chart visualizations and Excel report generation functionality.

## Current State

| Current Tab | Purpose |
|-------------|---------|
| Analytics | General asset analytics (status, condition, category, brand) |
| Subcategory Analytics | Subcategory-specific breakdown with hierarchical view |
| Location Reports | Location/sublocation/department analytics with charts |

**Problem:** Three separate tabs for related analytics functionality creates fragmentation and requires users to navigate between tabs for a complete view.

## Proposed Solution

Create a single **"Analytics & Reports"** tab with internal sub-navigation:

```text
+----------------------------------------------------------+
| Analytics & Reports                         [Export All] |
+----------------------------------------------------------+
| [Overview] [Category] [Subcategory] [Location] [Reports] |
+----------------------------------------------------------+
|                                                          |
|   Content based on selected sub-tab                      |
|                                                          |
+----------------------------------------------------------+
```

---

## New Component Structure

### File: `src/components/warehouse/UnifiedAssetAnalytics.tsx` (NEW)

A single component that consolidates all analytics with internal tabs:

**Sub-tabs:**
1. **Overview** - KPIs, status/condition pie charts, financial summary (from AssetAnalytics)
2. **Category Analysis** - Category/brand breakdown (from AssetAnalytics)
3. **Subcategory Analysis** - Hierarchical subcategory view (from SubcategoryAnalytics)
4. **Location Reports** - Location/sublocation/department analytics (from LocationReportAnalytics)
5. **Generate Reports** - Dedicated report generation panel with filters and export options

### Report Generation Panel Features

```text
+----------------------------------------------------------+
| Generate Reports                                          |
+----------------------------------------------------------+
| Report Type:                                              |
| [Location-wise] [Sub-Location-wise] [Department-wise]    |
| [Category-wise] [Subcategory-wise]                       |
+----------------------------------------------------------+
| Filters:                                                  |
| Location:     [All Locations v]                          |
| Sub-Location: [All Sub-Locations v]                      |
| Category:     [All Categories v]                         |
| Status:       [All Statuses v]                           |
| Date Range:   [From]  [To]                               |
+----------------------------------------------------------+
| [Preview Report]                    [Export to Excel]    |
+----------------------------------------------------------+
| Report Preview Table                                      |
| (Shows filtered data before export)                       |
+----------------------------------------------------------+
```

---

## Implementation Details

### 1. Create UnifiedAssetAnalytics Component

**Structure:**
```typescript
interface UnifiedAssetAnalyticsProps {
  assets: WarehouseAsset[];
  locations: WarehouseLocation[];
  categories: AssetCategory[];
  totalCount?: number;
  activeCount?: number;
  maintenanceCount?: number;
}

// Internal sub-tabs
type AnalyticsTab = 
  | "overview" 
  | "category" 
  | "subcategory" 
  | "location" 
  | "reports";
```

**Component contains:**
- Internal `<Tabs>` for sub-navigation
- Reuses logic from existing analytics components
- New "Generate Reports" section with comprehensive filters
- Preview table before export
- Export functionality for each report type

### 2. Report Types Supported

| Report Type | Grouping | Key Columns |
|-------------|----------|-------------|
| Location-wise | Primary locations | Location, Asset Count, Value, Status Breakdown |
| Sub-Location-wise | Sub-locations | Location, Sub-Location, Asset Count, Value |
| Department-wise | Departments | Location, Sub-Location, Department, Assets, Value |
| Category-wise | Main categories | Category, Asset Count, Value, Condition Breakdown |
| Subcategory-wise | Subcategories | Category, Subcategory, Assets, Value, Depreciation |

### 3. Update AssetManagement.tsx

**Changes:**
1. Change TabsList from `grid-cols-6` to `grid-cols-4`:
   - Assets List
   - Asset Master
   - Asset Requests
   - **Analytics & Reports** (consolidated)

2. Remove separate tab triggers for:
   - Analytics
   - Subcategory Analytics
   - Location Reports

3. Replace with single tab content using `UnifiedAssetAnalytics`

4. Remove imports for old components (can keep for backward compatibility or delete)

---

## Visual Layout

### Tab Structure After Change

**Before (6 tabs):**
```text
[Assets List] [Asset Master] [Asset Requests] [Analytics] [Subcategory Analytics] [Location Reports]
```

**After (4 tabs):**
```text
[Assets List] [Asset Master] [Asset Requests] [Analytics & Reports]
```

### Analytics & Reports Internal Layout

```text
+------------------------------------------------------------------+
|                    Analytics & Reports                            |
+------------------------------------------------------------------+
| [Overview] [Category] [Subcategory] [Location] [Generate Reports] |
+------------------------------------------------------------------+
|                                                                   |
| Overview Tab:                                                     |
| +------------------+------------------+------------------+         |
| | Total Assets     | Utilization Rate | Total Value     |         |
| | 1,234            | 85.2%           | Rs. 12,345,678  |         |
| +------------------+------------------+------------------+         |
|                                                                   |
| +------------------------+ +------------------------+             |
| | Status Distribution    | | Condition Distribution |             |
| | (Pie Chart)            | | (Pie Chart)            |             |
| +------------------------+ +------------------------+             |
|                                                                   |
+------------------------------------------------------------------+

Generate Reports Tab:
+------------------------------------------------------------------+
| Report Type: [Location v]   Status: [All v]   Category: [All v]  |
+------------------------------------------------------------------+
| [Preview]                                    [Export to Excel]   |
+------------------------------------------------------------------+
| Preview Table:                                                    |
| | Location      | Assets | Active | Maintenance | Value        | |
| | Head Office   | 245    | 210    | 15          | Rs. 2,500,000| |
| | Branch A      | 180    | 150    | 20          | Rs. 1,800,000| |
| ...                                                               |
+------------------------------------------------------------------+
```

---

## Files to Create

| File | Purpose |
|------|---------|
| `src/components/warehouse/UnifiedAssetAnalytics.tsx` | Consolidated analytics with all sub-tabs and report generation |

## Files to Modify

| File | Changes |
|------|---------|
| `src/pages/warehouse/AssetManagement.tsx` | Reduce to 4 tabs, use UnifiedAssetAnalytics |

## Files to Optionally Remove

| File | Reason |
|------|--------|
| `src/components/warehouse/AssetAnalytics.tsx` | Merged into UnifiedAssetAnalytics (or keep as sub-component) |
| `src/components/warehouse/SubcategoryAnalytics.tsx` | Merged into UnifiedAssetAnalytics (or keep as sub-component) |
| `src/components/warehouse/LocationReportAnalytics.tsx` | Merged into UnifiedAssetAnalytics (or keep as sub-component) |

**Recommendation:** Keep existing components as sub-components for modularity and import them into UnifiedAssetAnalytics.

---

## Technical Approach

### Option A: Wrapper Component (Recommended)
Create `UnifiedAssetAnalytics` as a wrapper that imports and renders existing components in tabs.

**Advantages:**
- Minimal code duplication
- Easier to maintain
- Preserves existing tested logic
- Faster implementation

### Option B: Full Merge
Copy all logic into a single large component.

**Disadvantages:**
- Large file size (~2000+ lines)
- Harder to maintain
- More testing required

**Selected: Option A**

---

## Implementation Steps

1. **Create `UnifiedAssetAnalytics.tsx`**
   - Import existing analytics components
   - Add internal Tabs structure
   - Create new "Generate Reports" section with:
     - Report type selector (5 types)
     - Filter dropdowns with cascading logic
     - Preview table
     - Export button

2. **Modify `AssetManagement.tsx`**
   - Change grid to 4 columns
   - Replace three tab triggers with one "Analytics & Reports"
   - Replace three TabsContent with single UnifiedAssetAnalytics
   - Keep imports for sub-components

3. **Test all report generation flows**
   - Location-wise export
   - Sub-location-wise export
   - Department-wise export
   - Category-wise export
   - Subcategory-wise export

---

## Report Generation Logic

```typescript
// Report types with their configurations
const reportConfigs = {
  location: {
    label: "Location-wise",
    groupByField: "location_id",
    columns: ["Location", "Total Assets", "Active", "Maintenance", "Inactive", "Total Value"]
  },
  sublocation: {
    label: "Sub-Location-wise",
    groupByField: "sublocation_id",
    columns: ["Location", "Sub-Location", "Total Assets", "Active", "Total Value"]
  },
  department: {
    label: "Department-wise",
    groupByField: "department_id",
    columns: ["Location", "Sub-Location", "Department", "Total Assets", "Value"]
  },
  category: {
    label: "Category-wise",
    groupByField: "category_id",
    columns: ["Category", "Total Assets", "Good", "Fair", "Poor", "Total Value"]
  },
  subcategory: {
    label: "Subcategory-wise",
    groupByField: "subcategory_id",
    columns: ["Category", "Subcategory", "Total Assets", "Value", "Depreciation"]
  }
};
```

---

## Dependencies
- `recharts` - Charts (already installed)
- `writeExcelFromJSON` - Excel export utility (already exists)
- Existing analytics components for reuse

