## Problem

In `RelocateBinDialog`, the destination Select shows an incomplete list. Two real causes in `src/components/warehouse/RelocateBinDialog.tsx`:

1. The `destinations` memo hard-filters by `l.company_id === bin.company_id`. When `bin.company_id` is `null` (global/template bins, or older rows that never had the column populated) the list collapses to empty. It also silently drops any sub-location whose `company_id` doesn't exactly match the bin row (data inherits company via parent in some places).
2. It builds breadcrumbs manually with only one level of parent lookup, so 3-level hierarchies (Warehouse › Sub-location › Department) render as a flat sibling list and depth‑2 nodes can collide/be hidden. The project already has `buildLocationOptions()` in `src/lib/warehouse/locationHierarchy.ts` that produces the proper indented, breadcrumb‑labelled list used by other pickers.

## Fix (frontend only)

Edit `src/components/warehouse/RelocateBinDialog.tsx`:

- Replace the hand-rolled `destinations` memo with `buildLocationOptions(locations, { activeOnly: true })`.
- Determine the bin's effective company via `getRootLocationId(...)` + the root location's `company_id` as a fallback when `bin.company_id` is null, so the dropdown still scopes correctly for legacy/global bins.
- Filter the option list with: `option.location.company_id === effectiveCompanyId && option.location.id !== bin.location_id`. If `effectiveCompanyId` cannot be resolved, fall back to "all active locations except current" so the user is never stuck with an empty list.
- Render options using `breadcrumb` (already pre-indented with `›`) and indent depth via `paddingLeft` (16px × depth) for visual hierarchy. Keep "↳" prefix off — `breadcrumb` already encodes the path.
- Wrap `SelectContent` in a max-height scroll (`max-h-[320px]`) so long lists scroll cleanly inside the dialog.
- Use the same helper for the `currentName` label so it matches the dropdown.
- Show a small loading state while `useWarehouseLocations` is fetching (currently it just renders an empty list).

No DB, RPC, or RLS changes. No behavior change to the relocate mutation itself.

## Acceptance

- Opening Relocate on any bin (including bins whose `company_id` is null) shows every other active warehouse / sub-location / department in the same company, indented by depth, scrollable.
- Current location is excluded.
- Loading state visible while locations fetch.
