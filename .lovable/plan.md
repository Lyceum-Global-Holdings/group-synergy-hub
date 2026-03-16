

## Plan: Restrict Location Dropdowns to User's Edit-Permitted Locations

### Problem
The "Add Item" and "Add Stock" dialogs in Construction Inventory show **all** locations, allowing users to add items to locations they don't have edit access to. For example, Shihan (who only has access to "Lyceum Wattala") can currently see and select any location.

### Solution
Filter the location dropdowns in both dialogs using `useCurrentUserLocationPermissions()`, the same pattern already used in `NewTransferDialog.tsx`. Only locations where the user has explicit **edit** permissions will appear.

### Changes

**1. `src/components/construction/inventory/AddItemDialog.tsx`**
- Import `useCurrentUserLocationPermissions`
- Fetch permissions, then filter `locations` to only those in `editLocationIds`
- Admin/Super Admin users (who get `viewAllLocations: true`) see all locations (unchanged behavior)
- Use the filtered list for both the machine `current_location_id` and bulk `location_id` dropdowns

**2. `src/components/construction/inventory/AddInventoryStockDialog.tsx`**
- Same change: import `useCurrentUserLocationPermissions`, filter the location dropdown to edit-permitted locations only

### Pattern (from existing `NewTransferDialog.tsx`)
```typescript
const { data: permissions } = useCurrentUserLocationPermissions();

const permittedLocations = useMemo(() => {
  if (!locations || !permissions) return [];
  if (permissions.viewAllLocations) return locations;
  const permittedIds = new Set(permissions.editLocationIds);
  return locations.filter(loc => permittedIds.has(loc.id));
}, [locations, permissions]);
```

Two files changed, no new files.

