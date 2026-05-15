## Root cause
The list on `/warehouse/partial-quantities` is filtered by the **global header location filter** (`globalLocationId`) via the `list_partial_pieces` RPC. The **Add Partial Piece** dialog ignores that filter — it shows every location, defaults to none, and lets the user save the piece against a different location (often the parent location, since bins live there). Result: the row is saved correctly but is hidden by the active sub-location filter, so it looks like nothing was added.

## Fix — align Add dialog with the active location context
Standard WMS practice (SAP EWM / Oracle WMS / Manhattan): when the operator is working in a scoped storage location, transactional create screens must inherit that scope and not let the user write outside it without an explicit override.

### `src/components/warehouse/partial-qty/AddPartialPieceDialog.tsx`
1. Read `globalLocationId` via `useLocationFilter()`.
2. When the dialog opens, prefill the Location field with `globalLocationId` (when set) and keep it in sync if the user changes the global filter.
3. When `globalLocationId` is set:
   - Lock the Location `<Select>` to that value (`disabled`) and render a small inline note: "Scoped by header filter: {location name}. Clear the global filter to add elsewhere."
   - Restrict the Bin dropdown to bins of that location (already the case via `bins-for-location` query) — also include bins of any descendant sub-locations is **out of scope**; one location at a time.
4. When `globalLocationId` is null, keep the current free choice.
5. On successful save, invalidation already includes `partial-pieces` and `partial-piece-items` — no change needed.

### `src/pages/warehouse/PartialQuantities.tsx`
1. When `globalLocationId` is set, surface the active scope in the page header as a small badge ("Showing: {location}") with a clear-filter button. This makes the empty-after-add scenario visually obvious for users who didn't realise a filter was active.
2. When the list is empty AND a global filter is active, change the empty state to: "No partial pieces at {location}. Clear the filter to see other locations or use Add piece to register one here."

### Out of scope
- No DB / RLS / RPC change — `list_partial_pieces` already filters by `p_location_id` correctly.
- No changes to Edit / Consume / Split / Import dialogs.
- No hierarchical "include children" behaviour — staying with a single location matches how the list already filters.

## Files to touch
- `src/components/warehouse/partial-qty/AddPartialPieceDialog.tsx`
- `src/pages/warehouse/PartialQuantities.tsx`

## Validation
- With a sub-location selected globally → open Add piece → Location field is pre-filled and locked → save → row appears immediately in the list at that sub-location.
- With no global filter → behaviour unchanged; user picks any location.
- Switching global filter while dialog is open updates the locked location.
