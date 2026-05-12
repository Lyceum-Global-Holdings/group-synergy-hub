## Problem

The Bin Allocations tab now shows "No results." The query in `useWarehouseBinAllocations` is failing with:

```
PGRST200 — Could not find a relationship between 'warehouse_locations' and 'warehouse_locations'
using the hint 'warehouse_locations_parent_id_fkey'
```

PostgREST does not resolve self-referencing foreign keys by constraint name; it needs the **column name** as the disambiguation hint. The whole `select` is rejected, so React Query receives an error and renders an empty table.

## Fix

Single one-line change in `src/hooks/useWarehouseBinAllocations.ts`:

Replace
```ts
parent:warehouse_locations!warehouse_locations_parent_id_fkey(
  id, name, location_code
)
```
with
```ts
parent:warehouse_locations!parent_id(
  id, name, location_code
)
```

Verified the corrected embed returns 200 from PostgREST. No other files need changes — the type already accepts `parent` as object or array, and `BinAllocationsTab.getLocationPath` already normalizes both shapes.

## Out of scope
- No DB / RLS / type changes.
- No UI changes — display logic for "Location › Sub-location" stays as-is.
