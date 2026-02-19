

# Add Location Field to Material Issue Notes

## What This Does

Adds a "Location" dropdown to the Material Issue Note form, allowing users to specify which warehouse location the materials are being issued to or from. This location will also be displayed in the issue details view and the issues list table.

## Changes

### 1. Database Migration

Add a `location_id` column to the `material_issue_notes` table, referencing `warehouse_locations`:

```sql
ALTER TABLE material_issue_notes 
ADD COLUMN location_id UUID REFERENCES warehouse_locations(id);
```

No RLS changes needed -- the existing policies on `material_issue_notes` already cover this column.

### 2. Update TypeScript Types (`src/types/materialIssueReturn.ts`)

- Add `location_id: string | null` to the `MaterialIssueNote` interface
- Add `location_id?: string` to the `CreateMaterialIssueData` interface

### 3. Update Create Dialog (`src/components/warehouse/CreateMaterialIssueDialog.tsx`)

- Import `useWarehouseLocations` hook
- Add `location_id` to the form state
- Add a Location dropdown (Select component) in the Header Info tab, populated from `warehouse_locations`
- Pass `location_id` when calling `createMaterialIssueAsync`

### 4. Update Details Dialog (`src/components/warehouse/MaterialIssueDetailsDialog.tsx`)

- Fetch the location name alongside the issue data (join with `warehouse_locations`)
- Display the location in the "Issue Details" section of the Overview tab

### 5. Update Issues List (`src/pages/warehouse/MaterialIssueReturn.tsx`)

- Add a "Location" column to the Material Issues table
- Fetch location name when querying issues (join with `warehouse_locations`)

### 6. Update Hook (`src/hooks/useMaterialIssues.ts`)

- Update the query to join with `warehouse_locations` to fetch location name alongside each issue
- No changes needed to create/update mutations (they already spread all fields)

## Summary

- 1 database migration (add column)
- 6 files updated
- Location selector uses the existing `warehouse_locations` table and `useWarehouseLocations` hook
