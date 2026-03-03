

# Fix: Location Filter Not Visible in VeBuild Company Dashboard

## Problem
The Location Master filter dropdown was added to `Dashboard.tsx` but is reported as not visible when viewing as the VeBuild company. The code exists (lines 135-146) but may not be rendering properly.

## Root Cause Analysis
After thorough investigation:
- The filter code exists in Dashboard.tsx and renders unconditionally
- VeBuild (company ID: `39ff33f9-...`) has **zero** company-specific locations in `warehouse_locations` — all 66 locations have `company_id = NULL` (shared)
- The `useLocations` hook correctly includes `company_id IS NULL` locations, so data should be available
- Possible causes: responsive layout hiding the element, or build/cache issue preventing the updated Dashboard from rendering

## Solution

### 1. Ensure Filter Visibility with Better Layout (Dashboard.tsx)
- Move the location filter to a more prominent position — place it on its own row below the title instead of squeezed into the header's flex row (which can overflow on smaller screens)
- Add a fallback message when no locations are available ("No locations configured")
- Wrap with a visible container so it's clearly identifiable

### 2. Create a Standalone useWarehouseLocations Hook
- Create a simpler, dedicated `src/hooks/useWarehouseLocations.ts` hook that doesn't depend on construction-specific `useAccessibleCompanyIds`
- This hook directly queries `warehouse_locations` filtered by the selected company ID or shared (NULL company_id) locations
- Reduces coupling between the Dashboard and the construction module

### 3. Ensure VeBuild Locations Exist
- The hook should always include shared locations (`company_id IS NULL`) so VeBuild users see the 66 available locations
- No database changes needed — the 66 shared locations will populate the dropdown

## Files to Modify
- **`src/pages/Dashboard.tsx`** — Restructure header layout to ensure filter is always visible; switch to new hook
- **`src/hooks/useWarehouseLocations.ts`** (new) — Standalone location fetching hook for the dashboard, independent of construction module

## Technical Details

**New hook (`useWarehouseLocations.ts`):**
```text
- Query: SELECT id, name, type FROM warehouse_locations 
         WHERE company_id = selectedCompanyId OR company_id IS NULL
         ORDER BY name
- Falls back to all locations when no company selected (super admin "All Companies" mode)
- Simple, no dependency on useAccessibleCompanyIds
```

**Dashboard layout change:**
```text
Before (single flex row, can overflow):
  [Title] .............. [Location Filter] [Last Updated Badge]

After (stacked, always visible):
  [Title] .............. [Last Updated Badge]
  [Location Filter - full width row with icon and label]
```

This ensures the dropdown is always visible regardless of screen size and data is always fetched correctly for VeBuild or any other company.

