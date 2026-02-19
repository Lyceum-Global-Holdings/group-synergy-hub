
# Replace Department with Location in Material Request Form

## What This Does

Replaces the free-text "Department" field in the Material Request form with a "Location" dropdown, identical to the one in Material Issue Notes. The dropdown will be populated from the `warehouse_locations` table.

## Changes

### 1. Database Migration

Add a `location_id` column to `material_requests` and keep the existing `department` column for backward compatibility (existing records may have department data):

```sql
ALTER TABLE material_requests 
ADD COLUMN location_id UUID REFERENCES warehouse_locations(id);
```

### 2. Update TypeScript Types (`src/types/materialIssueReturn.ts`)

- `MaterialRequest` interface: add `location_id: string | null`
- `CreateMaterialRequestData` interface: replace `department?: string` with `location_id?: string`

### 3. Update Create Dialog (`src/components/warehouse/CreateMaterialRequestDialog.tsx`)

- Import `useWarehouseLocations` hook
- Replace the `department` text input (line 280-288) with a Location dropdown (Select component) populated from `warehouse_locations` -- same pattern as the Material Issue Note form
- Update form state: replace `department: ""` with `location_id: ""`
- Update the review step (line 526) to show the selected location name instead of department

### 4. Update Details Dialog (`src/components/warehouse/MaterialRequestDetailsDialog.tsx`)

- Change "Department" display (lines 122-127) to show the location name
- Fetch location name by joining with `warehouse_locations` or looking it up from the request's `location_id`

### 5. Update Convert to Issue Dialog (`src/components/warehouse/ConvertToIssueDialog.tsx`)

- When converting a request to an issue, pass `location_id` instead of `department` (line 53)
- Update the summary display (line 116) from "Department" to "Location"

### 6. Update Hook (`src/hooks/useMaterialRequests.ts`)

- Update the query to join with `warehouse_locations` to fetch location name

### 7. Update Material Requests List (`src/pages/warehouse/MaterialIssueReturn.tsx`)

- If the requests table shows a "Department" column, update it to show "Location" with the resolved name

## Summary

- 1 database migration (add `location_id` column)
- 6 files updated
- Department text input replaced with Location dropdown using the same `useWarehouseLocations` hook and pattern as Material Issue Notes
