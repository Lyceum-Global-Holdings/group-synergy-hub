# Plan: Match bin filter by (location, bin_code) instead of bin row id

## Root cause

Bin options now come from `useWarehouseBins` (the `warehouse_bins` table), but `BinAllocationWithDetails.warehouse_bin.id` is the id embedded by the allocations query. Per `mem://architecture/bin-uniqueness` the bins table can hold both a NULL-company "template" row and a company-scoped row for the same physical bin; `useWarehouseBins` dedupes to one row, while allocations may still point at the other. So the selected `bin.id` never equals `allocation.warehouse_bin.id` and the table empties out (or filters incorrectly).

## Fix

Identify bins by their **physical address** — `${location_id}::${lower(bin_code)}` — exactly the natural key the DB unique index already uses. This is row-id-agnostic and matches WMS standards.

- `BinFilterOption.id` becomes that composite key.
- `selectedBinIds` stores composite keys.
- The allocation filter compares `${allocation.warehouse_bin.warehouse_location.id}::${lower(allocation.warehouse_bin.bin_code)}` against the set.
- The "prune stale selections on scope change" effect keeps working — visible-keys check is unchanged.

## Files

- `src/components/warehouse/BinAllocationsTab.tsx` — rebuild `binOptions` with composite keys; update the allocation filter to compare the same key.

No DB or hook changes.
