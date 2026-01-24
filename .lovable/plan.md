

## Sync Asset Master Changes to Asset Inventory

### Problem
When you edit an asset master item (e.g., change the name from "Executive Chair" to "Premium Executive Chair"), the change only affects the `asset_master` table. The related records in `warehouse_assets` (Asset Inventory) still show the old name.

### Solution
Modify the `updateAssetMaster` mutation in `useAssetMaster.ts` to also update all related `warehouse_assets` records that reference the edited asset master.

### Implementation

**File: `src/hooks/useAssetMaster.ts`**

Update the `updateAssetMasterMutation` to sync changes:

```typescript
const updateAssetMasterMutation = useMutation({
  mutationFn: async ({ id, ...assetData }: Partial<AssetMaster> & { id: string }) => {
    // 1. Update the asset master record
    const { data, error } = await supabase
      .from('asset_master')
      .update(assetData)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    // 2. Sync changes to all related warehouse_assets
    const syncData: Record<string, any> = {};
    
    // Map asset_master fields to warehouse_assets fields
    if (assetData.asset_name !== undefined) syncData.name = assetData.asset_name;
    if (assetData.brand !== undefined) syncData.brand = assetData.brand;
    if (assetData.category_id !== undefined) syncData.category_id = assetData.category_id;
    if (assetData.subcategory_id !== undefined) syncData.subcategory_id = assetData.subcategory_id;
    if (assetData.description !== undefined) syncData.description = assetData.description;
    if (assetData.purchase_price !== undefined) syncData.purchase_price = assetData.purchase_price;
    if (assetData.current_value !== undefined) syncData.current_value = assetData.current_value;
    if (assetData.depreciation_method !== undefined) syncData.depreciation_method = assetData.depreciation_method;
    if (assetData.depreciation_rate !== undefined) syncData.depreciation_rate = assetData.depreciation_rate;
    if (assetData.useful_life_years !== undefined) syncData.useful_life_years = assetData.useful_life_years;
    if (assetData.salvage_value !== undefined) syncData.salvage_value = assetData.salvage_value;

    // Only sync if there are fields to update
    if (Object.keys(syncData).length > 0) {
      syncData.updated_at = new Date().toISOString();
      
      const { error: syncError } = await supabase
        .from('warehouse_assets')
        .update(syncData)
        .eq('asset_master_id', id);

      if (syncError) {
        console.error('Error syncing to warehouse_assets:', syncError);
        // Don't throw - master update succeeded, sync is secondary
      }
    }

    return data;
  },
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: ['asset-master'] });
    queryClient.invalidateQueries({ queryKey: ['warehouse-assets'] }); // Also refresh inventory
    toast({
      title: "Success",
      description: "Asset master and inventory items updated successfully",
    });
  },
  // ... rest of error handling
});
```

### Fields Synced

| Asset Master Field | Warehouse Asset Field |
|-------------------|----------------------|
| `asset_name` | `name` |
| `brand` | `brand` |
| `category_id` | `category_id` |
| `subcategory_id` | `subcategory_id` |
| `description` | `description` |
| `purchase_price` | `purchase_price` |
| `current_value` | `current_value` |
| `depreciation_method` | `depreciation_method` |
| `depreciation_rate` | `depreciation_rate` |
| `useful_life_years` | `useful_life_years` |
| `salvage_value` | `salvage_value` |

### Behavior
- When you edit any of the above fields in Asset Master, all associated inventory items will automatically update
- The success message will confirm both updates
- If the sync fails for any reason, the master update still succeeds (graceful degradation)
- Both `asset-master` and `warehouse-assets` query caches will be invalidated to refresh the UI

### Files to Modify

| File | Change |
|------|--------|
| `src/hooks/useAssetMaster.ts` | Add sync logic to `updateAssetMasterMutation` |

