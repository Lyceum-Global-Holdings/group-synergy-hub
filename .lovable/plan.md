

## Auto-capture location when adding a tool

### Outcome

When a user adds a tool, the **location is auto-filled from the global header `LocationSelector`** (the same scope that drives the inventory tab). The created tool immediately appears in that location's standalone inventory — no extra step. The user can still override before saving.

### Standards applied

- **SAP EWM "default storage location" pattern** — the active plant/site is auto-applied to new master data; the user only confirms or overrides.
- **ISO 9241-110 (Conformity with user expectations)** — the location the user is currently filtering on is the location they most likely mean.
- **Project memory `global-location-context-and-filtering`** — the header `LocationSelector` is the canonical scope; new write flows must honour it.
- **WCAG 2.2 SC 3.3.2** — required field gets a sensible, visible default rather than an empty trap.

### Behaviour

1. **Global location set** (e.g. user is viewing "Colombo Warehouse"):
   - `CreateToolDialog` opens with **Location pre-selected** to that location.
   - A small inline hint under the field: "Auto-filled from current location filter." with a "Change" affordance (just editing the select clears the hint).
   - Tool is saved with `location_id = globalLocationId` → instantly visible in the location-scoped inventory list (the one already wired in `useWarehouseTools`).

2. **Global location is "All locations"**:
   - Field stays empty and **required** with helper text: "Select a location — tools must belong to a site (ISO 55000)."
   - Submit button disabled until chosen. (This change tightens the current optional behaviour — see "Schema note" below.)

3. **`ImportFromItemMasterDialog`**:
   - When the global location is set, default the destination location for promoted tools to it; show the same "Auto-filled" hint at the top of the dialog.
   - When "All locations", keep the existing per-row location choice; surface a banner: "Pick a global location to auto-assign all imports."

4. **`BulkToolImportDialog` (CSV)**:
   - For rows where the `location` cell is blank, fall back to `globalLocationId` (if set) instead of failing validation. Add a banner: "Blank Location cells will use the current location: {name}."

5. **`EditToolDialog`**:
   - No auto-fill (editing should not silently move a tool). Existing trigger guard already blocks location change while bin allocations exist.

### Schema note (light)

`warehouse_tools.location_id` is currently nullable. Per ISO 55000 §6.2.6 (equipment must be traceable to a site) we should make location **required for new tools** at the application layer in this iteration, and leave existing NULL rows as-is (shown as "Unassigned" in the inventory tab — already handled). No migration needed yet; a follow-up migration can add `NOT NULL` after legacy rows are back-filled.

### Files

**Modified**
- `src/components/warehouse/tools/CreateToolDialog.tsx`
  - Read `globalLocationId` from `useLocationFilter()`.
  - Initialise `formData.location_id` with it; reset to it on close.
  - Add helper text + "Auto-filled" badge when value matches `globalLocationId`.
  - Mark Location as required; disable submit if empty.
- `src/components/warehouse/tools/ImportFromItemMasterDialog.tsx`
  - Default the per-import destination location to `globalLocationId` when set; banner above the table.
- `src/components/warehouse/tools/BulkToolImportDialog.tsx`
  - In the parser, if `location` cell is empty and `globalLocationId` is set, populate `location_id` with it before validation; add banner.
- `src/components/warehouse/tools/EditToolDialog.tsx` — no functional change (just keep current behaviour; not auto-overridden).

**No DB migration in this iteration.**

### Verification

1. Set global location to "Colombo" → click Add Tool → Location pre-selected to "Colombo" with hint; save → tool appears in Colombo inventory immediately.
2. Switch global location to "All locations" → Add Tool → Location is empty + required; submit disabled until chosen.
3. Open Import from Item Master with a global location set → banner shows; promoted tools land in that location.
4. CSV import with blank Location column + global location set → rows validate and import to that location; without global location, rows still flag the missing field.
5. Edit an existing tool → Location field reflects the saved value, never silently overridden.

