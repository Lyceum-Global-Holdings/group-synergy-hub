

# Plan: Location/Sub-Location Wise Asset Reports for Fixed Assets

## Status: ✅ COMPLETED

## Overview
Add a detailed location-wise and sub-location-wise asset report generation feature to the Fixed Assets module. Users can generate and download comprehensive Excel reports showing assets grouped by location and sub-location.

## Implementation Complete

### Files Created:
1. **`src/hooks/useAssetLocationReport.ts`** - Custom hook for fetching asset data with location/category joins
2. **`src/components/finance/assets/AssetLocationReportDialog.tsx`** - Dialog for report configuration and Excel export

### Files Modified:
1. **`src/pages/finance/FixedAssets.tsx`** - Added "Location Report" button and dialog integration

### Features Implemented:
- Location and sub-location filtering (hierarchical)
- Category filtering
- Status filtering (Available, In Use, Under Maintenance, Disposed, Retired)
- Purchase date range filtering
- Excel export with comprehensive asset details
- Sorted by Location > Sub-Location > Asset Name

### 1. Hook: `src/hooks/useAssetLocationReport.ts`

A custom hook to fetch and process asset data grouped by location/sub-location.

**Features:**
- Fetch assets from `warehouse_assets` with category, location, and sublocation joins
- Support filters: location, sublocation, category, status, date range
- Group data by location and sublocation hierarchy
- Calculate totals per location (count, total value, depreciated value)
- Return structured data for Excel export

**Interface:**
```typescript
interface AssetLocationReportFilters {
  locationId?: string;        // Optional: specific location
  sublocationId?: string;     // Optional: specific sublocation
  categoryId?: string;        // Optional: filter by asset category
  status?: string;            // Optional: active, disposed, etc.
  startDate?: string;         // Optional: purchase date from
  endDate?: string;           // Optional: purchase date to
}

interface AssetLocationReportItem {
  asset_id: string;
  asset_tag: string | null;
  asset_name: string;
  brand: string | null;
  category_name: string | null;
  subcategory_name: string | null;
  serial_number: string | null;
  location_name: string;
  sublocation_name: string | null;
  status: string;
  condition: string;
  purchase_date: string | null;
  purchase_price: number | null;
  current_value: number | null;
  accumulated_depreciation: number | null;
  depreciation_method: string | null;
  useful_life_years: number | null;
  notes: string | null;
}
```

### 2. Dialog: `src/components/finance/assets/AssetLocationReportDialog.tsx`

A dialog component for report configuration and generation.

**UI Elements:**
- Location selector (dropdown with "All Locations" option)
- Sub-location selector (filtered by selected location, with "All Sub-Locations" option)
- Category filter (dropdown)
- Status filter (dropdown: All, Active, Disposed, Under Maintenance, Retired)
- Date range filter (purchase date from/to)
- "Generate Report" button
- Loading state while generating

**Features:**
- Similar pattern to `StockMovementReportDialog.tsx`
- Uses `writeExcelFromJSON` for Excel export
- Filename format: `asset-location-report-{company}-{location/all}-{date}.xlsx`

---

## Excel Report Format

### Detailed Report Columns:
| Column | Description |
|--------|-------------|
| Location | Primary location name |
| Sub-Location | Sub-location within the location |
| Asset Tag | Unique asset identifier |
| Asset Name | Name of the asset |
| Brand | Brand/manufacturer |
| Category | Asset category |
| Sub-Category | Asset sub-category |
| Serial Number | Asset serial number |
| Status | Current status (Active/Disposed/etc.) |
| Condition | Physical condition |
| Purchase Date | Date of acquisition |
| Purchase Price (LKR) | Original purchase cost |
| Current Value (LKR) | Current book value |
| Accum. Depreciation (LKR) | Total depreciation to date |
| Depreciation Method | Straight Line/Declining Balance |
| Useful Life (Years) | Expected useful life |
| Notes | Additional notes |

### Report Organization:
- Assets sorted by Location > Sub-Location > Asset Name
- Summary section at bottom with totals per location

---

## Files to Modify

### 1. `src/pages/finance/FixedAssets.tsx`

Add a "Location Report" button to the header next to existing buttons:

```typescript
<Button variant="outline" onClick={() => setShowLocationReportDialog(true)}>
  <MapPin className="h-4 w-4 mr-2" />
  Location Report
</Button>
```

Add state and import for the dialog:
```typescript
const [showLocationReportDialog, setShowLocationReportDialog] = useState(false);

// At end of component
<AssetLocationReportDialog 
  open={showLocationReportDialog} 
  onOpenChange={setShowLocationReportDialog} 
/>
```

---

## Data Flow

```text
User clicks "Location Report" button
              |
              v
  AssetLocationReportDialog opens
              |
              v
  User selects filters (location, category, etc.)
              |
              v
  User clicks "Generate Report"
              |
              v
  useAssetLocationReport.fetchReport() called
              |
              v
  Query warehouse_assets with joins:
  - warehouse_locations (location_id)
  - warehouse_locations (sublocation_id)
  - asset_categories (category_id)
  - asset_categories (subcategory_id)
              |
              v
  Transform to AssetLocationReportItem[]
              |
              v
  Map to Excel export format
              |
              v
  writeExcelFromJSON() generates .xlsx file
              |
              v
  Browser downloads file
```

---

## Implementation Steps

1. **Create hook** `src/hooks/useAssetLocationReport.ts`
   - Query warehouse_assets with location/category joins
   - Apply filters (location, sublocation, category, status, date range)
   - Sort by location, sublocation, asset name
   - Return formatted report items

2. **Create dialog** `src/components/finance/assets/AssetLocationReportDialog.tsx`
   - Location dropdown using `useWarehouseLocations`
   - Sublocation dropdown filtered by selected location
   - Category dropdown using `useAssetCategories`
   - Status dropdown (hardcoded options)
   - Date range inputs
   - Generate button with loading state
   - Excel export using existing utility

3. **Update Fixed Assets page** `src/pages/finance/FixedAssets.tsx`
   - Add "Location Report" button
   - Add state for dialog visibility
   - Import and render the dialog

---

## Technical Notes

- Uses existing `useWarehouseLocations` hook for location data
- Uses existing `useAssetCategories` hook for category filter
- Uses existing `writeExcelFromJSON` utility for Excel export
- Follows same pattern as `StockMovementReportDialog` for consistency
- No database schema changes required
- Company context automatically applied through existing patterns

## Dependencies

No new dependencies required. Uses existing:
- ExcelJS (via excelUtils)
- date-fns for date formatting
- Existing UI components (Dialog, Select, Button, etc.)

