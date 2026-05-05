## Goal
In the **Create Material Issue Note** dialog, pre-select the **Issue Location** based on the user's currently active context (global Location filter + selected Company), following SAP MM "default plant/storage location" UX standards.

## Behavior (international standard — SAP MM / Oracle Inventory)
1. **Primary default**: when the dialog opens, if a global location is selected in the header (`useLocationFilter().globalLocationId`) AND it belongs to the selected company, pre-fill `formData.location_id` with it.
2. **Fallback**: if no global location is selected but the selected company has exactly one warehouse location, default to that single location (standard SAP behavior — auto-pick when only one storage location exists).
3. **Company scoping**: only locations belonging to `selectedCompany.id` are offered in the dropdown. If the global location does not belong to the active company, do not pre-select (leave empty, force explicit choice).
4. **Reactivity**: if the user changes the company or global location while the dialog is open, the default re-applies *only if the user has not manually overridden* the field (track with a `locationTouched` flag).
5. **Reset**: after submit / dialog close, clear `locationTouched` so next open picks up fresh defaults.
6. **Visual hint**: show the selected company name as a small muted helper line under the location field, e.g. _"Defaulted from active context — Company: Lyceum Global Holdings"_, so the user clearly sees which tenant/site they are issuing from (audit clarity).

## Technical changes

**File: `src/components/warehouse/CreateMaterialIssueDialog.tsx`**
- Import `useLocationFilter`.
- Filter `locations` to `selectedCompany.id` (use existing `company_id` field on warehouse_locations).
- Add `locationTouched` state.
- Add `useEffect` keyed on `[open, selectedCompany?.id, globalLocationId, filteredLocations]` that:
  - returns early if `locationTouched` or dialog closed;
  - if `globalLocationId` exists in `filteredLocations` → set it;
  - else if `filteredLocations.length === 1` → set that one;
  - else clear.
- In the location `Select onValueChange`, set `locationTouched = true`.
- On dialog close / successful submit, reset `locationTouched = false` along with the existing form reset.
- Add helper text under the location Select showing active company + (if defaulted) "Auto-selected from header".

No DB / hook / RPC changes needed — purely a UX defaulting layer on top of the already location-scoped issuance logic implemented previously.

## Out of scope
- No changes to Material Request / Material Return dialogs (user asked specifically about MIN).
- No changes to RPC, RLS, or types.
