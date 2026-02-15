

# Add Edit/Update Function to Warehouse Management Locations

## What This Does

Adds an **Edit** button to each row in the Warehouse Management locations table. Clicking it opens a pre-filled edit dialog where users can update all location fields (name, type, status, capacity, contact info, address, etc.) and save changes.

## Current State

- Each row only has **View** and **Delete** buttons
- The `updateLocation` mutation already exists in `useWarehouseLocations` hook and works correctly
- The `LocationManagementDialog` has edit functionality but it is a separate full dialog for managing all locations -- not ideal for quick single-row edits

## Changes

### File: `src/pages/admin/WarehouseManagement.tsx`

**1. Add edit state**

Add state for tracking which location is being edited:
```
const [editLocationData, setEditLocationData] = useState<WarehouseLocation | null>(null);
```

**2. Add Edit button to each row**

Insert an Edit button (pencil icon) between the View and Delete buttons in the Actions column (around line 438-455):
```
<Button size="sm" variant="ghost" onClick={() => setEditLocationData(location)}>
  <Edit2 className="h-4 w-4" />
</Button>
```

**3. Add an Edit Location Dialog**

Create an inline `Dialog` component at the bottom of the page (next to the existing `LocationDetailsDialog`) that:
- Opens when `editLocationData` is not null
- Pre-fills a form with the selected location's current values (name, type, status, location_code, description, capacity, contact_person, contact_phone, physical_address, warehouse_category)
- Provides dropdowns for type, status, and warehouse_category
- Provides a parent location selector (filtered by type)
- Calls `updateLocation({ id, ...updatedFields })` on save
- Closes and resets state on cancel or successful save
- Follows the standard dialog sizing (max-w-4xl, max-h-85vh with scroll)

**4. Wire up updateLocation and isUpdating**

Destructure `updateLocation` and `isUpdating` from the existing `useWarehouseLocations()` hook call (line 43 already has `updateLocation` but `isUpdating` is not destructured -- add it).

## Form Fields in the Edit Dialog

| Field | Type | Notes |
|-------|------|-------|
| Name | Text input | Required |
| Location Code | Text input | Optional |
| Type | Dropdown | location / sublocation / department |
| Parent | Dropdown | Filtered by type selection |
| Status | Dropdown | active / inactive / maintenance / closed |
| Warehouse Category | Dropdown | raw_materials / finished_goods / general / wip / returns / quarantine |
| Capacity | Number input | Optional |
| Description | Textarea | Optional |
| Contact Person | Text input | Optional |
| Contact Phone | Text input | Optional |
| Physical Address | Textarea | Optional |

## Summary

- One file modified: `src/pages/admin/WarehouseManagement.tsx`
- Adds per-row Edit button and an edit dialog
- Uses the existing `updateLocation` mutation -- no backend changes needed
- Follows the established dialog sizing and layout standards

