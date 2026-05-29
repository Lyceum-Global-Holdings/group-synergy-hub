# Plan: Bin-wise filter on Bin Allocations

Add a searchable bin selector next to the existing search/location chips on `/warehouse/bin-allocations`, so users can drill down to a single bin (or a multi-select of bins). Mirrors SAP EWM / Oracle WMS "Storage Bin" filter pattern.

## UX

- New control in the `BinAllocationsTab` header row, left of the search input:
  - Label-less Combobox-style trigger: **"All bins"** by default; shows `bin_code` (with count) when one is selected, or `"N bins"` when multiple.
  - Popover with:
    - Search input (filters by `bin_code` or `name`).
    - Multi-select checkbox list of bins.
    - "Clear" button and "Select all (filtered)" action.
  - When the global location filter is set, the bin list is restricted to bins inside that warehouse subtree — staying consistent with the existing `scope` logic.
  - Selected bins also surface as removable chips next to the existing `MapPin` location chip, so the active filter is visible at a glance.
- Empty state: if a bin filter is active and no rows match, show "No allocations in selected bin(s)" with a "Clear bin filter" button.
- Bulk QR button + count update to reflect filtered set (already wired to `filteredAllocations`, no change needed).

## Data / logic

- Derive the bin options from the already-loaded `binAllocations` (distinct by `warehouse_bin.id`), so we don't add a network round-trip. Each option carries `{ id, bin_code, name, location_id, location_path }`.
- Sort options natural-numerically by `bin_code` (matches `useWarehouseBins` convention from `mem://architecture/bin-uniqueness`).
- Filter pipeline in `filteredAllocations` (in order): company scope (existing) → location scope (existing) → **bin filter (new)** → free-text search (existing).
- State: `const [selectedBinIds, setSelectedBinIds] = useState<Set<string>>(new Set())`. Empty set = no filter.
- When the global location changes and the currently selected bins fall outside the new scope, prune them automatically (so stale chips don't linger).

## Files

- `src/components/warehouse/BinAllocationsTab.tsx` — add state, derive bin options, extend filter, render selector + chips.
- `src/components/warehouse/bin-allocations/BinFilterPopover.tsx` *(new)* — small presentational component using existing `Popover`, `Command`, `Checkbox`, `Button` primitives from `src/components/ui`. Keeps `BinAllocationsTab` readable.

## Out of scope

- No DB / RPC / hook changes.
- No changes to create/move/return dialogs.
- No URL-param persistence for the filter (can be added later if requested).
