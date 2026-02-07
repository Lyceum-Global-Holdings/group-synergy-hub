
# Fix: Sync Finance Fixed Assets with Warehouse Asset Data

## Problem Identified
Finance Fixed Assets components are not showing any assets because:

| Component | Filter Used | Issue |
|-----------|-------------|-------|
| AssetRegister.tsx | `.eq("company_id", selectedCompany?.id)` | No match - warehouse_assets have NULL company_id |
| AssetReports.tsx | `.eq("company_id", selectedCompany?.id)` | No match |
| RunDepreciationDialog.tsx | `.eq("company_id", selectedCompany?.id)` | No match |
| DepreciationScheduleView.tsx | `.eq("company_id", selectedCompany?.id)` | No match |
| AssetTransactionList.tsx | `.eq("company_id", selectedCompany?.id)` | No match |

Meanwhile, **Warehouse Asset Management** (`useWarehouseAssets.ts`) queries **without** any company_id filter, so it shows all assets.

## Database Evidence
```
warehouse_assets records:
- company_id: NULL (all records)
- Data exists: "4 Cluster Table", "Office Cupboard", etc.
```

## Solution
Remove the `company_id` filter from `warehouse_assets` queries in Finance Fixed Assets components to match the Warehouse module's behavior.

---

## Files to Modify

### 1. `src/components/finance/assets/AssetRegister.tsx`
**Line 41** - Remove company filter:
```typescript
// Before
.eq("company_id", selectedCompany?.id)

// After
// Remove this line - warehouse doesn't filter by company
```

### 2. `src/components/finance/assets/AssetReports.tsx`
**Line 32** - Remove company filter:
```typescript
// Before
.eq("company_id", selectedCompany?.id)

// After
// Remove this line
```

### 3. `src/components/finance/assets/RunDepreciationDialog.tsx`
**Line 73** - Remove company filter from assets query:
```typescript
// Before
.eq("company_id", selectedCompany?.id)
.eq("status", "active")

// After
.eq("status", "active")
```

### 4. `src/components/finance/assets/DepreciationScheduleView.tsx`
**Line 39** - Keep company filter (depreciation_schedule is company-specific)

### 5. `src/components/finance/assets/AssetTransactionList.tsx`
**Line 33** - Keep company filter (asset_transactions is company-specific)

---

## Implementation Summary

| File | Change |
|------|--------|
| AssetRegister.tsx | Remove `.eq("company_id", ...)` from warehouse_assets query |
| AssetReports.tsx | Remove `.eq("company_id", ...)` from warehouse_assets query |
| RunDepreciationDialog.tsx | Remove `.eq("company_id", ...)` from warehouse_assets query |
| DepreciationScheduleView.tsx | Keep as-is (queries depreciation_schedule, not warehouse_assets directly) |
| AssetTransactionList.tsx | Keep as-is (queries asset_transactions, not warehouse_assets directly) |

---

## After Fix
- Finance Fixed Assets will show the same assets as Warehouse Asset Management
- Both modules will be in sync
- Depreciation can be run on visible assets
- Reports will show accurate data

---

## Technical Notes
- This is a minimal change that aligns Finance with the existing Warehouse behavior
- No database migrations required
- Depreciation schedule and transaction tables still use company_id for their own records (which is correct for financial data)
