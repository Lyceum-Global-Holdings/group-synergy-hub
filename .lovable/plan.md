

# Plan: Add Location, Sub-Location, Department-wise Reports to Warehouse Asset Management

## Overview
Add a comprehensive reporting feature to the Warehouse Asset Management page that allows generating reports grouped by:
- Location
- Sub-location
- Department

These reports will be exportable to Excel and will include filters for category, status, condition, and date range.

---

## Current Architecture

| Component | Purpose |
|-----------|---------|
| `warehouse_assets` table | Stores assets with `location_id`, `sublocation_id`, `department_id` |
| `warehouse_locations` table | Unified location table with `type` field (location/sublocation/department) |
| `AssetLocationReportDialog` (Finance) | Existing report dialog pattern to follow |
| `useAssetLocationReport` hook | Existing hook for location reports |

---

## Implementation Details

### 1. Create New Report Hook

**New File:** `src/hooks/useWarehouseAssetReport.ts`

```typescript
// Filters interface
interface WarehouseAssetReportFilters {
  locationId?: string;
  sublocationId?: string;
  departmentId?: string;
  categoryId?: string;
  subcategoryId?: string;
  status?: string;
  condition?: string;
  startDate?: string;
  endDate?: string;
  groupBy: 'location' | 'sublocation' | 'department';
}

// Report item interface with aggregated data
interface WarehouseAssetReportItem {
  asset_id: string;
  asset_tag: string | null;
  asset_name: string;
  brand: string | null;
  category_name: string | null;
  serial_number: string | null;
  location_name: string;
  sublocation_name: string | null;
  department_name: string | null;
  status: string;
  condition: string | null;
  purchase_date: string | null;
  purchase_price: number | null;
  current_value: number | null;
}
```

**Key Features:**
- Query `warehouse_assets` with joins to `warehouse_locations` for location, sublocation, and department
- Apply filters for all dimensions
- Support grouping/ordering by location, sublocation, or department

---

### 2. Create Report Dialog Component

**New File:** `src/components/warehouse/WarehouseAssetReportDialog.tsx`

**UI Structure:**
```text
+------------------------------------------+
| Warehouse Asset Reports              [X] |
+------------------------------------------+
| Report Type:                             |
| [Location] [Sub-Location] [Department]   |
+------------------------------------------+
| Filters:                                 |
| Location:    [All Locations v]           |
| Sub-Location:[All Sub-Locations v]       |
| Department:  [All Departments v]         |
| Category:    [All Categories v]          |
| Status:      [All Statuses v]            |
| Condition:   [All Conditions v]          |
| Date Range:  [From] [To]                 |
+------------------------------------------+
| Generate report organized by selected    |
| grouping with all applied filters.       |
+------------------------------------------+
| [Cancel]            [Generate Report]    |
+------------------------------------------+
```

**Features:**
- Three report types via tabs/toggle: Location-wise, Sub-location-wise, Department-wise
- Cascading filters (sublocation depends on location, department depends on sublocation)
- Export to Excel with columns ordered by selected grouping
- Loading state and empty state handling

---

### 3. Update Asset Management Page

**File:** `src/pages/warehouse/AssetManagement.tsx`

**Changes:**
1. Import the new `WarehouseAssetReportDialog` component
2. Add state for dialog visibility: `const [isReportDialogOpen, setIsReportDialogOpen] = useState(false)`
3. Add "Reports" button in the header next to existing buttons

**Button Location:**
```text
[Bulk Import] [Categories] [Locations] [Reports] [+ Add Asset]
                                        ^^^^^^^
                                        New button
```

---

### 4. Excel Export Format

**Location-wise Report Columns:**
| Location | Asset Tag | Asset Name | Category | Status | Condition | Value |

**Sub-location-wise Report Columns:**
| Location | Sub-Location | Asset Tag | Asset Name | Category | Status | Value |

**Department-wise Report Columns:**
| Location | Sub-Location | Department | Asset Tag | Asset Name | Status | Value |

---

## Files to Create

| File | Purpose |
|------|---------|
| `src/hooks/useWarehouseAssetReport.ts` | Hook for fetching and filtering report data |
| `src/components/warehouse/WarehouseAssetReportDialog.tsx` | Dialog component with filters and export |

## Files to Modify

| File | Changes |
|------|---------|
| `src/pages/warehouse/AssetManagement.tsx` | Add Reports button and dialog import |

---

## Data Flow

```text
User clicks "Reports" button
          |
          v
WarehouseAssetReportDialog opens
          |
          v
User selects report type + filters
          |
          v
useWarehouseAssetReport.fetchReport() called
          |
          v
Query warehouse_assets with:
  - location join (warehouse_locations)
  - sublocation join (warehouse_locations)
  - department join (warehouse_locations)
  - category join (asset_categories)
          |
          v
Data mapped to report items
          |
          v
Excel generated via writeExcelFromJSON()
          |
          v
File downloaded
```

---

## Filter Dependencies

| Selection | Enables |
|-----------|---------|
| Location selected | Sub-location filter shows options for that location |
| Sub-location selected | Department filter shows options for that sub-location |
| Location = "All" | Sub-location filter disabled |
| Sub-location = "All" | Department filter disabled |

---

## Status Options
- All Statuses
- Active
- Inactive
- Maintenance
- Disposed

## Condition Options
- All Conditions
- Good
- Fair
- Poor
- Needs Repair

---

## Implementation Order

1. Create `useWarehouseAssetReport.ts` hook with:
   - Filter interface
   - Report item interface
   - `fetchReport()` function with joins and filters
   - Loading and error states

2. Create `WarehouseAssetReportDialog.tsx` with:
   - Report type selection (tabs)
   - All filter dropdowns with cascading logic
   - Date range inputs
   - Generate button with loading state
   - Excel export using existing `writeExcelFromJSON` utility

3. Update `AssetManagement.tsx`:
   - Import dialog component
   - Add state for dialog
   - Add "Reports" button with FileSpreadsheet icon

4. Test end-to-end:
   - Generate location-wise report
   - Generate sub-location-wise report
   - Generate department-wise report
   - Verify filters work correctly
   - Verify Excel export contains correct data

