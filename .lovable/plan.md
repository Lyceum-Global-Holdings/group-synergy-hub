# Fix: Sub-locations not showing in Adjust Stock dialog

## Problem
In `StockAdjustmentDialog` (Decrease Stock → "Issue to Sub-Location"), the screenshot shows a single "Location *" dropdown that says "No locations available". The current flow asks the user to first pick a parent Location, then a Sub-Location. `parentLocations` is filtered to `type === 'location'` only, and when no such records exist (or none are visible in the user's scope) the picker is empty and the sub-location step never appears.

The user already picked a Bin (LNQ - LNQ at the LNQ location), so requiring them to re-pick the parent location is redundant.

## Fix (frontend only, `src/components/warehouse/StockAdjustmentDialog.tsx`)

1. Derive the parent location from the **selected bin** (`bins.find(b => b.id === binId).location_id`). If the bin's location is itself a sub-location, walk up to its `parent_id` to find the true parent.
2. Remove the "Location *" parent picker UI entirely. Show only the **Sub-Location** picker, populated with all active sub-locations whose `parent_id` matches the bin's parent location.
3. Show the resolved parent location name as static text above the sub-location picker, e.g. "Issuing from: LNQ".
4. If no bin is selected yet, hide the sub-location picker and show a hint: "Select a bin first".
5. If the bin's location has no sub-locations, show "No sub-locations under {location name}" (existing disabled item, but using the derived parent).
6. Update the submit handler:
   - `selectedParentLocation` becomes the derived parent (not from a dropdown).
   - Validation: when `issueToSubLocation` is on, require `binId` and `selectedSubLocationId`.
7. Reset `selectedSubLocationId` when `binId` changes (parent context shifted).
8. Remove now-unused `selectedLocationId` state and `parentLocations` memo.

## Out of scope
- No backend / RPC / RLS changes.
- No changes to how bins or locations are fetched.
- Increase Stock flow unchanged.

## Files
- `src/components/warehouse/StockAdjustmentDialog.tsx` (only file edited)
