
# Fix: Asset Count Shows Wrong in Asset List

## Problem

The KPI cards (Total Assets, Active Assets, Maintenance Assets) display **server-side unfiltered counts** from separate database queries, while the asset table shows **client-side filtered results**. When the user applies any filter (search, location, sub-location, category), the table updates but the KPI cards still show the total unfiltered counts -- making them appear wrong.

Additionally, the count queries use `staleTime: 30000` (30-second cache) which contradicts the project standard of `staleTime: 0`, causing counts to lag behind after mutations.

## Fix

### File: `src/pages/warehouse/AssetManagement.tsx`

**Derive counts from `filteredAssets` instead of server-side counts.**

Replace lines 425-429:
```
const totalValue = assets.reduce(...);
const displayTotalAssets = totalCount ?? assets.length;
const displayActiveAssets = activeCount ?? ...;
const displayMaintenanceAssets = maintenanceCount ?? ...;
```

With:
```
const totalValue = filteredAssets.reduce((sum, asset) => sum + (asset.purchase_price || 0), 0);
const displayTotalAssets = filteredAssets.length;
const displayActiveAssets = filteredAssets.filter(a => a.status === "active").length;
const displayMaintenanceAssets = filteredAssets.filter(a => a.status === "maintenance").length;
```

This ensures:
- When no filters are applied, the cards show the correct total (from all loaded assets)
- When filters are applied, the cards reflect the filtered subset
- The total value also updates to reflect only the filtered assets

### File: `src/hooks/useWarehouseAssets.ts`

**Remove staleTime overrides** from the three count queries (lines 39, 53, 67) so they follow the global `staleTime: 0` standard. This prevents stale counts after asset creation/deletion.

## Summary

- Two files modified with small edits
- KPI cards will now always match the assets shown in the table
- Total value will also reflect filtered results
- Count queries will stay fresh per the project standard
