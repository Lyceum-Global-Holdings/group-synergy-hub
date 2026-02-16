

# Fix: Value Calculation Bug Across All Analytics Components

## Root Cause

The previous fix only updated `LocationReportAnalytics.tsx`, but the sub-location report values shown in the "Generate Reports" tab and overview KPIs come from **separate calculations** in `UnifiedAssetAnalytics.tsx` that were never fixed. Additionally, multiple other analytics components have the same `||` vs `??` bug.

The `||` operator treats `0` as falsy, causing assets with `current_value = 0` (fully depreciated) to fall back to their `purchase_price`, inflating totals.

## Files and Changes

### 1. `src/components/warehouse/UnifiedAssetAnalytics.tsx`

**Line 256** - Report data aggregation (this is the main culprit for the "Generate Reports" sub-location report):
```
// Before
data.totalValue += asset.current_value || asset.purchase_price || 0;
// After
data.totalValue += asset.current_value ?? asset.purchase_price ?? 0;
```

**Lines 337-339** - Overview KPI total value:
```
// Before
const totalValue = assets.reduce(
  (sum, a) => sum + (a.current_value || a.purchase_price || 0), 0
);
// After
const totalValue = assets.reduce(
  (sum, a) => sum + (a.current_value ?? a.purchase_price ?? 0), 0
);
```

### 2. `src/components/warehouse/AssetAnalytics.tsx`

**Lines 33, 63, 81, 96** - Category value, location value, brand value, and financial metrics calculations:
- Replace all `(asset.current_value || asset.purchase_price || 0)` with `(asset.current_value ?? asset.purchase_price ?? 0)`

### 3. `src/components/warehouse/SubcategoryAnalytics.tsx`

**Line 122** - Subcategory value aggregation:
```
// Before
acc[subId].totalValue += (asset.current_value || asset.purchase_price || 0);
// After
acc[subId].totalValue += (asset.current_value ?? asset.purchase_price ?? 0);
```

### 4. `src/pages/warehouse/AssetManagement.tsx`

**Line 1144** - Asset list display value:
```
// Before
Rs. {(asset.current_value || asset.purchase_price || 0).toLocaleString()}
// After
Rs. {(asset.current_value ?? asset.purchase_price ?? 0).toLocaleString()}
```

## Summary

Total: **7 occurrences** across **4 files** that need the `||` to `??` fix. This ensures consistent, correct value calculations everywhere in the Warehouse module.
