## Problem

The Reports Center "Location" filter only lists top-level **locations** (`type = 'location'`). Sub-locations and department-level stocking nodes are hidden, so users can't drill into a specific warehouse zone, bay, or department for any report — even though stock is actually held against those nodes (`warehouse_items.location_id` may point to a location, sublocation, or department per `get_stock_bearing_locations_for_company`).

## Standard being followed

- **SAP EWM hierarchy** — Plant → Storage Location → Storage Bin. Pickers expose every level a user can stock against, indented under its parent.
- **Oracle Fusion Inventory Org pickers** — same indented dropdown with type chips.
- **WCO Data Model / GS1 GLN** — physical locations form a tree; reports must support filtering at any node.
- Project memory `mem://architecture/warehouse-location-and-bin-management` confirms any node can be stock-bearing.

## Solution

Switch the Reports Center location parameter from a flat list to a **hierarchical, indented, single-select dropdown** that includes locations + sub-locations + departments. The selected node id is sent as the existing `p_location_id` parameter — no DB or RPC changes.

### Data source

Use the canonical `useStockBearingLocationsForCompany(selectedCompany.id)` RPC (`get_stock_bearing_locations_for_company`) instead of `useEffectiveLocationsForCompany`. It already returns every node — location, sublocation, department — that the active company can stock against, with `parent_id`, `depth`, `is_standalone_warehouse`. It also already enforces user permissions via RLS.

### UI

Replace the basic `<Select>` for `type: "location"` with a searchable Combobox built from the existing shadcn `Popover` + `Command` primitives (already used elsewhere in the project — see `src/components/common/LocationSelector.tsx` if present, otherwise create inline):

```text
[ All locations                          ▾ ]
 ┌──────────────────────────────────────────┐
 │ 🔍 Search locations…                     │
 ├──────────────────────────────────────────┤
 │ All locations                            │
 │ ▸ Main Warehouse                  LOC    │
 │     ▸ Receiving Zone              SUB    │
 │         ▸ Bay 1                   DEPT   │
 │     ▸ Storage Zone                SUB    │
 │ ▸ Distribution Center             LOC    │
 └──────────────────────────────────────────┘
```

- Tree built client-side from the flat list using `parent_id`. Roots first, children indented by `depth`.
- Each row shows: indent + name + small muted type chip (`LOC`, `SUB`, `DEPT`).
- Search filters by name across all levels; matching descendants keep their ancestors visible for context.
- Single-select. Selecting a parent filters by **only that node** (matches existing RPC semantics — equality on `location_id`). A short helper line under the field reads:
  *"Filters by the exact node selected. Pick a sub-location or department to drill down."*
- Keyboard nav (↑ ↓ Enter Esc) and ARIA listbox roles via `Command`.
- Loading / empty / disabled states reuse the patterns already added in the previous fix.

### Permissions / company scoping (unchanged guarantees)

- Server-side RPC is company-scoped and RLS-protected.
- `useUserViewAllLocations` + `user_location_permissions` intersection still applied client-side, now against the full hierarchy (a child is included only if it's in the permitted set OR `view_all_locations` is true). Children of a permitted parent are NOT auto-included — matches the rest of the app's strict per-node permission model.
- Stale-id cleanup effect from the previous fix continues to clear any selection that drops out of the allowed set on company switch.

### Server-side compatibility

No migration needed. All five report RPCs that take `p_location_id` already do `WHERE location_id = p_location_id`, which works for any node id whether it's a location, sublocation, or department, because `warehouse_items.location_id` stores whichever node owns the stock.

### Files to change

- `src/components/management/reports/ReportParameterPanel.tsx`
  - Swap data source: `useEffectiveLocationsForCompany` → `useStockBearingLocationsForCompany`.
  - Replace the `case "location"` Select with a new `<LocationTreePicker>` subcomponent (Popover + Command + indented items, type chips, search).
  - Keep the existing permission intersection, default-from-`globalLocationId`, stale-id cleanup, and empty-state UX.
- No registry, RPC, or types changes.

## Acceptance criteria

- The Location dropdown lists every stock-bearing node for the active company: locations, their sub-locations, and departments.
- Items are visibly indented; type chip shown next to each name.
- Search box filters across all levels and keeps matching ancestors visible.
- Selecting a sub-location or department runs the report scoped to that exact node.
- Selecting "All locations" preserves the current behavior (no `p_location_id` passed).
- Switching company refreshes the tree; an out-of-scope previously-selected node is cleared automatically.
- Users without `view_all_locations` only see nodes they are explicitly permitted on (no implicit inheritance through children).
