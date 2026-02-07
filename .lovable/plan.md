
# Plan: Sync Finance Fixed Assets with Warehouse Asset Management

## Overview
Finance Fixed Assets and Warehouse Asset Management are currently working with different tables, causing data inconsistency. This plan synchronizes both modules to use `warehouse_assets` as the single source of truth for individual physical assets.

## Current Architecture

| Module | Table | Purpose |
|--------|-------|---------|
| Finance → Fixed Assets | `asset_master` | Asset "templates/definitions" |
| Warehouse → Asset Management | `warehouse_assets` | Individual physical assets |

### Current Sync
- ONE-WAY: When `asset_master` is updated, changes propagate to `warehouse_assets` via `asset_master_id`
- Finance sees asset templates, not actual physical assets
- Depreciation runs on `asset_master`, not on individual `warehouse_assets`

## Proposed Architecture

Use `warehouse_assets` as the single source of truth for all physical assets:

```text
asset_master (Templates)
     |
     | (one-to-many via asset_master_id)
     v
warehouse_assets (Physical Assets) <-- Single Source of Truth
     |
     |-- Finance Fixed Assets (reads/writes)
     |-- Warehouse Asset Management (reads/writes)
     |-- Depreciation (runs here)
     |-- Location Reports (already uses this)
```

---

## Implementation Details

### 1. Update Finance Asset Register

**File:** `src/components/finance/assets/AssetRegister.tsx`

Change from querying `asset_master` to querying `warehouse_assets`:

**Before:**
```typescript
.from("asset_master")
.select(`*, asset_categories (name)`)
```

**After:**
```typescript
.from("warehouse_assets")
.select(`
  *,
  asset_master (asset_name, image_url),
  category:asset_categories!warehouse_assets_category_id_fkey (name),
  location:warehouse_locations!warehouse_assets_location_id_fkey (name),
  sublocation:warehouse_locations!warehouse_assets_sublocation_id_fkey (name)
`)
```

**Display Changes:**
- Show asset tag/serial number
- Show location and sub-location columns
- Show individual asset depreciation status

### 2. Update Finance Asset Reports

**File:** `src/components/finance/assets/AssetReports.tsx`

Change summary statistics to aggregate from `warehouse_assets`:

- Total Assets = count of `warehouse_assets`
- Total Cost = sum of `warehouse_assets.purchase_price`
- Net Book Value = sum of (`purchase_price` - `accumulated_depreciation`)
- Group by location in addition to category

### 3. Update Run Depreciation Dialog

**File:** `src/components/finance/assets/RunDepreciationDialog.tsx`

Switch depreciation to run on individual `warehouse_assets`:

**Changes:**
1. Query depreciable assets from `warehouse_assets` (where `status = 'active'` and depreciation_method is set)
2. Calculate depreciation per physical asset
3. Update each `warehouse_assets` record with new depreciation values
4. Create `depreciation_schedule` entries linked to `warehouse_assets.id`
5. Create `asset_transactions` entries linked to `warehouse_assets.id`

**Note:** This requires either:
- Option A: Change `depreciation_schedule.asset_id` FK to reference `warehouse_assets` (schema change)
- Option B: Add new column `depreciation_schedule.warehouse_asset_id` (additive schema change - safer)

### 4. Update Depreciation Schedule View

**File:** `src/components/finance/assets/DepreciationScheduleView.tsx`

Update query to join with `warehouse_assets` instead of `asset_master`:

```typescript
.from("depreciation_schedule")
.select(`
  *,
  warehouse_asset:warehouse_assets!depreciation_schedule_warehouse_asset_id_fkey (
    name,
    asset_tag,
    purchase_price,
    location:warehouse_locations!warehouse_assets_location_id_fkey (name)
  ),
  accounting_periods (period_name, start_date, end_date)
`)
```

### 5. Update Asset Transaction List

**File:** `src/components/finance/assets/AssetTransactionList.tsx`

Update to reference `warehouse_assets` for transaction history.

### 6. Create Bidirectional Sync Hook (Optional Enhancement)

**New File:** `src/hooks/useAssetSync.ts`

For aggregate statistics that `asset_master` might need:

```typescript
// When warehouse_assets are modified, update asset_master aggregates
const syncAssetMasterAggregates = async (assetMasterId: string) => {
  const { data } = await supabase
    .from('warehouse_assets')
    .select('purchase_price, accumulated_depreciation, current_value')
    .eq('asset_master_id', assetMasterId);

  // Calculate totals
  const totalPurchasePrice = data.reduce((sum, a) => sum + (a.purchase_price || 0), 0);
  const totalAccumDepr = data.reduce((sum, a) => sum + (a.accumulated_depreciation || 0), 0);
  
  // Update asset_master with aggregates
  await supabase
    .from('asset_master')
    .update({
      purchase_price: totalPurchasePrice,
      accumulated_depreciation: totalAccumDepr,
      current_value: totalPurchasePrice - totalAccumDepr,
    })
    .eq('id', assetMasterId);
};
```

---

## Database Schema Change

Add a new column to `depreciation_schedule` to link to individual assets:

```sql
ALTER TABLE depreciation_schedule 
ADD COLUMN warehouse_asset_id UUID REFERENCES warehouse_assets(id);

-- Keep asset_id for backward compatibility with asset_master
-- New depreciation entries will use warehouse_asset_id
```

---

## Files to Modify

| File | Changes |
|------|---------|
| `src/components/finance/assets/AssetRegister.tsx` | Query `warehouse_assets`, add location columns |
| `src/components/finance/assets/AssetReports.tsx` | Aggregate from `warehouse_assets` |
| `src/components/finance/assets/RunDepreciationDialog.tsx` | Run depreciation on `warehouse_assets` |
| `src/components/finance/assets/DepreciationScheduleView.tsx` | Join with `warehouse_assets` |
| `src/components/finance/assets/AssetTransactionList.tsx` | Reference `warehouse_assets` |
| `src/hooks/useAssetMaster.ts` | Add aggregate sync on warehouse_assets changes |

---

## Data Flow After Implementation

```text
User adds asset in Warehouse Asset Management
              |
              v
     Creates record in warehouse_assets
              |
              v
     Finance Fixed Assets shows this asset
              |
              v
     Run Depreciation updates warehouse_assets
              |
              v
     Both modules show updated depreciation values
              |
              v
     Location Report works correctly (already uses warehouse_assets)
```

---

## Benefits

1. **Single Source of Truth** - Both modules use `warehouse_assets`
2. **Accurate Location Tracking** - Finance sees asset locations
3. **Individual Asset Depreciation** - Depreciation runs per physical asset
4. **No Data Duplication** - Eliminates sync issues
5. **Existing Reports Work** - Location report already uses correct table

## Migration Consideration

Existing `asset_master` entries without corresponding `warehouse_assets` records will need migration:
- Option 1: Auto-create `warehouse_assets` records for each `asset_master`
- Option 2: Display warning in Finance when assets exist only in `asset_master`

---

## Implementation Order

1. Add `warehouse_asset_id` column to `depreciation_schedule` (schema)
2. Update `AssetRegister.tsx` to query `warehouse_assets`
3. Update `AssetReports.tsx` for aggregate statistics
4. Update `RunDepreciationDialog.tsx` to depreciate `warehouse_assets`
5. Update `DepreciationScheduleView.tsx` for new joins
6. Update `AssetTransactionList.tsx` for transaction references
7. Test end-to-end: add asset in warehouse, view in finance, run depreciation
