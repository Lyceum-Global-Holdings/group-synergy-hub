

# Fix: Wrong Total Value Due to JavaScript `||` Operator on Zero Values

## Root Cause

The value calculation uses `asset.current_value || asset.purchase_price || 0` throughout the file. In JavaScript, `||` treats `0` as falsy. So when an asset has `current_value = 0` (e.g., fully depreciated), the expression skips the `0` and falls through to `purchase_price`, which could be a large number like 500,000. This inflates the total value significantly.

**Example:**
- Asset with `current_value = 0`, `purchase_price = 500,000`
- `0 || 500000 || 0` evaluates to `500,000` (wrong -- should be `0`)

## Fix

Replace all `||` with `??` (nullish coalescing) for value calculations. `??` only falls through on `null` or `undefined`, not on `0`.

- `asset.current_value ?? asset.purchase_price ?? 0` correctly returns `0` when `current_value` is `0`
- It still falls back to `purchase_price` when `current_value` is `null`/`undefined`

## File: `src/components/warehouse/LocationReportAnalytics.tsx`

**5 locations to update** (all the same pattern change):

1. **Line 377** - Per-location value aggregation
2. **Line 400** - Category value tracking
3. **Line 420** - Subcategory value tracking
4. **Line 446** - Asset Master value tracking
5. **Line 537** - KPI total value calculation

Each changes from:
```
asset.current_value || asset.purchase_price || 0
```
To:
```
asset.current_value ?? asset.purchase_price ?? 0
```

## Result
- Assets with `current_value = 0` will correctly contribute `0` to totals instead of their `purchase_price`
- Assets with `current_value = null` will still correctly fall back to `purchase_price`
- This is a universal fix that applies to all report types (location, sub-location, department)

