

## Fix: Fall Back to All Locations When Company Has No Mapped Locations

### Problem
When a company has no entries in `warehouse_location_companies` and no legacy `company_id` mappings, the location selector shows "No permitted locations" and the user is locked out of all location-dependent features (inventory, transfers, bins, dashboard). This is a common scenario for newly created companies or companies that operate across shared sites.

### International Standard Alignment
Per ISO 55001 (Asset Management) and supply chain best practices, operational visibility should never be blocked by incomplete administrative configuration. The principle of **fail-open for visibility, fail-closed for writes** applies: users should see all available locations until explicit restrictions are configured.

### Solution
Add a fallback in three key locations: if a company has zero mapped locations, return **all** locations instead of an empty list.

### Files to Edit

**1. `src/components/common/LocationSelector.tsx`** (header location dropdown)
- After fetching `companyLocations`, if the result is empty, fetch all locations (type = 'location') as a fallback
- This ensures users always have a location to select

**2. `src/hooks/useWarehouseLocations.ts`** — `useDashboardLocations` function
- Same logic: if the company-filtered query returns zero results, fall back to returning all locations
- Dashboard widgets will still show data

**3. `src/hooks/useWarehouseBins.ts`** — no changes needed
- Already handles this correctly: when no location permissions are configured, it shows all bins (line 36 comment)

### Implementation Detail

In both the LocationSelector query and `useDashboardLocations`, after merging mapped + legacy rows:

```
if (merged.size === 0) {
  // No locations mapped to this company — fall back to all locations
  const { data: allLocations } = await supabase
    .from('warehouse_locations')
    .select('id, name, type')
    .eq('type', 'location')
    .order('name');
  return allLocations ?? [];
}
```

This is a safe, non-destructive change — once locations are properly mapped to a company, the fallback is never triggered.

