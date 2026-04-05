
## Fix: Regular Users Still See “No permitted locations” and Stock Errors

### What’s actually happening
The current implementation still has a fail-closed branch in `LocationSelector.tsx`:

- company fallback now returns all locations correctly
- but regular users are still filtered again by `useCurrentUserLocationPermissions()`
- when they have **no explicit location permission rows**, the selector returns an empty list
- the component then writes `__no_location_access__` into `globalLocationId`

That sentinel value is then reused by inventory/stock queries as if it were a real location ID, which explains the stock-side errors and empty results.

### Best-practice solution
Adopt the international-standard pattern already implied by your earlier decisions:

- **Fail open for visibility**
- **Fail closed for write actions**
- **Never store UI sentinel values in shared business filters**

This preserves operational continuity and aligns with ISO 55001 / warehouse governance best practices.

### Implementation plan

#### 1. Fix `LocationSelector.tsx`
Update the selector so regular users with no explicit location permissions can still see all company-visible locations.

Changes:
- while permissions are loading, do not compute an empty list or force a fallback state
- if user is admin / `viewAllLocations`, show all company locations
- if user has explicit permitted location IDs, filter by them
- if user has **zero explicit location permission records**, treat this as **unrestricted visibility fallback** and show all company locations
- remove the `__no_location_access__` sentinel flow entirely

Result:
- regular users will see actual locations instead of “No permitted locations”
- the selector will never poison app state with a fake location ID

#### 2. Protect the shared location context
In `LocationSelector.tsx`, only set `globalLocationId` to:
- `null` for All Locations
- a real location UUID from the available list

Never set synthetic values like `__no_location_access__`.

#### 3. Harden inventory stock queries
Update `ItemMasterTab.tsx` so location-based stock queries only run when `globalLocationId` is a valid selectable location from the current options.

Changes:
- guard the stock-by-location query against invalid/stale location IDs
- if the selected location is missing from the available locations list, fall back to all-locations behavior instead of querying with a bad ID
- avoid returning false “no stock” states caused by invalid filter values

#### 4. Align inventory hooks with the same visibility rule
Review and adjust warehouse inventory hooks so “no explicit permission rows” means visible data, not hidden data.

Files likely needing alignment:
- `src/hooks/useWarehouseItems.ts`
- `src/hooks/useWarehouseItemsLazyInventory.ts`

Rule:
- if `viewAllLocations` is false **but both permission arrays are empty**, do not restrict bins/items by location

This keeps selector behavior, inventory list behavior, and stock aggregation behavior consistent.

### Files to update
- `src/components/common/LocationSelector.tsx`
- `src/components/warehouse/ItemMasterTab.tsx`
- `src/hooks/useWarehouseItems.ts`
- `src/hooks/useWarehouseItemsLazyInventory.ts`

### Expected outcome
After this fix:
- regular users will see all relevant locations when no location mapping is configured for them
- the header will no longer show “No permitted locations” in this scenario
- inventory stock queries will stop failing due to the fake location value
- write restrictions can remain enforced separately through existing approval/RLS/permission guards

### Technical notes
Current root cause confirmed from the code:
- `LocationSelector.tsx` lines 76–87: empty permission arrays currently produce `[]`
- `LocationSelector.tsx` lines 98–100: empty result writes `__no_location_access__`
- `ItemMasterTab.tsx` lines 223–229: stock query uses `globalLocationId` directly, so the sentinel breaks downstream logic

This is primarily a frontend consistency bug, not a database-mapping bug.
