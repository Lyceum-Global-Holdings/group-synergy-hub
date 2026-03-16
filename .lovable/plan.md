

# Plan: Filter Warehouse Inventory by Global Location Selection

## Problem
When a user selects a location in the global header selector, the Inventory tab (and Item Master tab) does not filter items based on that location. Items should only appear if they have stock in bins belonging to the selected location. "All Locations" should show the full inventory.

## How It Works Today
- `globalLocationId` is set via the header `LocationSelector` component
- Warehouse tabs (`ItemMasterTab`, `ItemMasterDefinitionTab`) do **not** consume `globalLocationId` at all
- Bins are linked to locations via `warehouse_bins.location_id`
- Inventory items are linked to bins via `warehouse_bin_allocations`
- The chain is: **Location → Bins → Allocations → Items**

## Solution

### 1. Pass `globalLocationId` into the Inventory tab's data hook

**File: `src/components/warehouse/ItemMasterTab.tsx`**
- Import `useLocationFilter` and read `globalLocationId`
- Pass it to `useWarehouseItemsLazyInventory` as a new `locationId` option
- Also use it to filter the `itemLocationStock` query so location-stock badges are scoped correctly

### 2. Add server-side location filtering to `useWarehouseItemsLazyInventory`

**File: `src/hooks/useWarehouseItemsLazyInventory.ts`**
- Accept a new `locationId?: string` parameter
- Include `locationId` in the query key so React Query re-fetches when location changes
- When `locationId` is provided:
  - First fetch bin IDs for that location: `warehouse_bins` where `location_id = locationId`
  - Then fetch allocations only for those bins (already done per-batch, just add `.in('bin_id', locationBinIds)` filter)
  - This naturally limits which items appear — only items with allocations in location-scoped bins will have stock and thus show up
- When `locationId` is null (All Locations), keep current behavior (no location filter)

### 3. Filter the bin dropdown to match location

**File: `src/components/warehouse/ItemMasterTab.tsx`**
- The existing `uniqueBins` memo and `binFilter` dropdown should naturally reflect only bins visible in the filtered data since they derive from `allItems`

### 4. Scope the location-stock side query

**File: `src/components/warehouse/ItemMasterTab.tsx`**
- The `itemLocationStock` query (lines 211-300) fetches all allocations globally — add location filtering here too when `globalLocationId` is set, so location-stock badges match

### 5. Apply same pattern to Item Master Definition tab (optional but consistent)

**File: `src/components/warehouse/ItemMasterDefinitionTab.tsx`**
- The Item Master (catalog) tab shows all catalog items regardless of stock — location filtering is less relevant here since it defines items, not inventory. No change needed.

## Summary of File Changes

| File | Change |
|------|--------|
| `src/hooks/useWarehouseItemsLazyInventory.ts` | Add `locationId` param; filter bins/allocations by location |
| `src/components/warehouse/ItemMasterTab.tsx` | Read `globalLocationId`, pass to hook, scope location-stock query |

