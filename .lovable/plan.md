

# Add Department Filter to Asset List

## What This Does

Adds a "Filter by Department" dropdown to the asset list filters, alongside the existing Location, Sub-Location, and Category filters. The department dropdown will be context-aware -- it will only show departments belonging to the currently selected sub-location, and will be disabled when no sub-location is selected.

## Changes

### File: `src/pages/warehouse/AssetManagement.tsx`

**1. Add department filter state** (near line 122, alongside existing filter states):
- Add `const [departmentFilter, setDepartmentFilter] = useState<string>("all");`

**2. Update sub-location filter change handler** (around line 968):
- When the sub-location filter changes, reset `departmentFilter` to `"all"` (same pattern as location resetting sub-location)

**3. Add department match to the filter logic** (around line 377):
- Add `const matchesDepartment = departmentFilter === "all" || asset.department_id === departmentFilter;`
- Include `matchesDepartment` in the return condition

**4. Add department filter dropdown** (after the sub-location filter Select, around line 994):
- Add a new `<Select>` for department, populated via `getLocationsByType("department", sublocationFilter)`
- Disable it when `sublocationFilter === "all"`

**5. Reset page on department filter change** (around line 444):
- Add `departmentFilter` to the `useEffect` dependency array that resets `currentPage` to 1

## Summary

- One file modified: `src/pages/warehouse/AssetManagement.tsx`
- Adds a department filter dropdown that is enabled only when a sub-location is selected
- Resets automatically when the parent sub-location filter changes
- Follows the exact same pattern as the existing sub-location filter

