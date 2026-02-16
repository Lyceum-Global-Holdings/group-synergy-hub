

# Fix: Exclude Disposed Assets from Total Value in Location Reports

## Problem
The sub-location report's total value includes assets with `status === 'disposed'`, inflating the financial totals with assets that are no longer in service.

## Solution
Exclude disposed assets from value calculations throughout the analytics computation. Disposed assets will still appear in asset counts and status breakdowns (so users can see them), but their values will not be included in `totalValue`, `valueDistribution`, or any financial KPIs.

## File: `src/components/warehouse/LocationReportAnalytics.tsx`

### Change 1: Per-location value aggregation (line 377)
In the asset aggregation loop, only add to `totalValue` if the asset is not disposed:

```typescript
// Before
data.totalValue += asset.current_value || asset.purchase_price || 0;

// After
if (asset.status !== 'disposed') {
  data.totalValue += asset.current_value || asset.purchase_price || 0;
}
```

### Change 2: KPI total value calculation (lines 534-536)
Filter out disposed assets from the total value KPI:

```typescript
// Before
const totalValue = filteredAssets.reduce(
  (sum, a) => sum + (a.current_value || a.purchase_price || 0), 0
);

// After
const totalValue = filteredAssets
  .filter((a) => a.status !== 'disposed')
  .reduce((sum, a) => sum + (a.current_value || a.purchase_price || 0), 0);
```

### Change 3: Category/subcategory/asset-master value tracking (lines 398-399 and similar)
Also exclude disposed assets from category and subcategory value breakdowns so drilldown values are consistent:

```typescript
// Only add value if not disposed
const assetValue = asset.status !== 'disposed' ? (asset.current_value || asset.purchase_price || 0) : 0;
```

## Result
- Disposed assets still appear in counts and status charts for visibility
- Financial totals (total value, value distribution, category values) exclude disposed assets
- Consistent across KPIs, charts, tables, Excel exports, and PDF exports

