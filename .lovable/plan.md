
# Add Sub-Location Filter to Asset List

## What This Does

Adds a "Sub-Location" dropdown filter next to the existing Location and Category filters in the asset list view. The sub-location dropdown is dependent on the selected location -- it only shows sub-locations belonging to the chosen location, and is disabled when "All Locations" is selected.

## Changes

### File: `src/pages/warehouse/AssetManagement.tsx`

**1. Add state for the sublocation filter**

Add a new state variable `sublocationFilter` initialized to `"all"`, alongside the existing `locationFilter` and `categoryFilter` (around line 120).

**2. Reset sublocation when location changes**

When the user changes the location filter, reset `sublocationFilter` back to `"all"` so stale sublocation selections don't persist. This will be handled by wrapping `setLocationFilter` in a handler that also calls `setSublocationFilter("all")`.

**3. Update `filteredAssets` logic**

Add a `matchesSublocation` check in the filter function (around line 367):
```
const matchesSublocation = sublocationFilter === "all" || asset.sublocation_id === sublocationFilter;
return matchesSearch && matchesLocation && matchesSublocation && matchesCategory;
```

**4. Add the Sub-Location dropdown in the UI**

Insert a new `Select` component between the Location and Category filters (after line 960). It will:
- Show "All Sub-Locations" as default
- List sub-locations for the currently selected location using the existing `getLocationsByType("sublocation", locationFilter)` helper
- Be disabled when `locationFilter === "all"` (since sub-locations need a parent location)

```text
Filter bar layout:
[Search] [Location ▼] [Sub-Location ▼] [Category ▼]
```

## Summary

- One file modified: `src/pages/warehouse/AssetManagement.tsx`
- Three small additions: state variable, filter logic, and UI dropdown
- Sub-location dropdown is context-aware (dependent on selected location, disabled otherwise)
