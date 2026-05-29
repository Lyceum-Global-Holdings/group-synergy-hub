# Plan: Bin filter sources all bins at the selected location

Currently the popover only lists bins that already appear in `binAllocations`. In the screenshot the active scope shows allocations under bin `1-A-1-1`, but the popover says "No bins found" — likely because `warehouse_bin.warehouse_location.id` for those rows sits outside the strict scope subtree, or simply that no rows resolved through the filter.

Switch the source of the picker so it always loads every bin physically attached to the selected location subtree (matching WMS standards: a Storage Bin filter must list real bins, not just bins that already hold stock).

## Logic

- Pull all bins via `useWarehouseBins()` (already permission-scoped and natural-sorted).
- Filter them to the active `scope.ids` set (the warehouse + sub-locations the user picked in the header). If no global location is selected, list all bins the user can see.
- Map each bin to a `BinFilterOption` enriched with its `location_path` resolved from the loaded `locations`. Bins with no allocations should still be listed (with no count badge needed).
- Keep the auto-prune effect so stale selections are dropped when scope changes.
- `filteredAllocations` keeps the bin-id filter unchanged.

## Files

- `src/components/warehouse/BinAllocationsTab.tsx` — replace the `binOptions` memo to source from `useWarehouseBins()` + `locations`, drop the allocation-derived path.

No new components, no DB changes.
