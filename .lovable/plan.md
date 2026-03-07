

## Problem

The `useWarehouseAssets` hook filters assets using `warehouse_assets.company_id = selectedCompanyId`. This means if location "LNNB" has assets owned by company A, but LNNB is also linked to company B (Lyceum Global Holdings) via the `warehouse_location_companies` junction table, those assets are invisible to company B users.

## Solution

Modify the asset fetching logic to use a two-step approach:

1. **First**, query `warehouse_location_companies` to get all location IDs linked to the selected company
2. **Then**, fetch assets where `company_id = selectedCompanyId` **OR** `location_id IN (linked location IDs)`

This ensures assets at shared locations are visible to all companies linked to those locations.

## Changes

### `src/hooks/useWarehouseAssets.ts`

Update the main assets query and all three count queries (total, active, maintenance) to:

1. Before the batch loop, fetch linked location IDs:
```typescript
// Get locations linked to this company
const { data: linkedLocs } = await supabase
  .from('warehouse_location_companies')
  .select('location_id')
  .eq('company_id', companyId);
const linkedLocationIds = linkedLocs?.map(r => r.location_id) || [];
```

2. Replace the simple `.eq('company_id', companyId)` filter with an OR filter:
```typescript
if (companyId) {
  if (linkedLocationIds.length > 0) {
    query = query.or(
      `company_id.eq.${companyId},location_id.in.(${linkedLocationIds.join(',')})`
    );
  } else {
    query = query.eq('company_id', companyId);
  }
}
```

3. Deduplicate results (since an asset could match both conditions) using a Set on asset IDs.

4. Apply the same pattern to the three count queries (total, active, maintenance). For counts, since `.or()` works with `head: true`, no deduplication is needed — the DB handles it.

### Files modified
- `src/hooks/useWarehouseAssets.ts` — All read queries updated to include location-linked assets

