## Goal

Scope the Bin Allocations tab to the warehouse/location selected in the global header location filter, matching the same UX already used by Stock Movement Trends on the Inventory page.

## Behavior

- **Global location selector = "All locations"** → show every allocation the user can see (current behavior).
- **Selected = a parent warehouse** → show allocations whose bin's location is that warehouse OR any sub-location below it (descendant set).
- **Selected = a sub-location** → show only allocations bound to that exact sub-location.

This matches how WMS hierarchy filters typically work (selecting a node includes its subtree).

## Implementation

Single file: `src/components/warehouse/BinAllocationsTab.tsx`.

1. Read `globalLocationId` via `useLocationFilter()`.
2. Pull all locations via `useWarehouseLocations()` (already cached, lightweight).
3. Build a `descendantIds(rootId)` memo: walk `parent_id` graph once, return `Set<string>` containing root + all descendants.
4. Extend the existing `filteredAllocations` `useMemo` to also filter by `allocation.warehouse_bin?.warehouse_location?.id ∈ descendantIds`.
5. Show a small inline scope indicator in the card header — e.g. `Scope: {locationName}` with a hint icon — only when `globalLocationId` is set, so users can see the active filter without leaving the page. No new selector control (the global header already drives this).
6. Update the bulk-QR count + button label to keep using `filteredAllocations.length` (already does).

## Out of scope

- No DB / RLS / hook signature changes — `useWarehouseBinAllocations` keeps fetching the user's full visible set; filtering stays client-side, consistent with how the search box already works on this tab.
- No change to the global header location selector itself.
- No change to `useWarehouseLocations` or its query key.
