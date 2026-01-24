import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { AssetMaster, CreateAssetMasterData } from '@/types/assetMaster';
import { useToast } from '@/hooks/use-toast';

export const useAssetMaster = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const {
    data: assetMasterItems = [],
    isLoading,
    error
  } = useQuery({
    queryKey: ['asset-master'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('asset_master')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as AssetMaster[];
    }
  });

  const createAssetMasterMutation = useMutation({
    mutationFn: async (assetData: CreateAssetMasterData) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      const { data, error } = await supabase
        .from('asset_master')
        .insert({
          ...assetData,
          created_by: user.id
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['asset-master'] });
      toast({
        title: "Success",
        description: "Asset master item created successfully",
      });
    },
    onError: (error) => {
      console.error('Error creating asset master:', error);
      toast({
        title: "Error",
        description: "Failed to create asset master item",
        variant: "destructive",
      });
    }
  });

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
      queryClient.invalidateQueries({ queryKey: ['warehouse-assets'] });
      toast({
        title: "Success",
        description: "Asset master and inventory items updated successfully",
      });
    },
    onError: (error) => {
      console.error('Error updating asset master:', error);
      toast({
        title: "Error",
        description: "Failed to update asset master item",
        variant: "destructive",
      });
    }
  });

  const deleteAssetMasterMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('asset_master')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['asset-master'] });
      toast({
        title: "Success",
        description: "Asset master item deleted successfully",
      });
    },
    onError: (error) => {
      console.error('Error deleting asset master:', error);
      toast({
        title: "Error",
        description: "Failed to delete asset master item",
        variant: "destructive",
      });
    }
  });

  const getInventoryCount = async (assetMasterId: string) => {
    const { count, error } = await supabase
      .from('warehouse_assets')
      .select('*', { count: 'exact', head: true })
      .eq('asset_master_id', assetMasterId);

    if (error) throw error;
    return count || 0;
  };

  return {
    assetMasterItems,
    isLoading,
    error,
    createAssetMaster: createAssetMasterMutation.mutate,
    updateAssetMaster: updateAssetMasterMutation.mutate,
    deleteAssetMaster: deleteAssetMasterMutation.mutate,
    getInventoryCount,
    isCreating: createAssetMasterMutation.isPending,
    isUpdating: updateAssetMasterMutation.isPending,
    isDeleting: deleteAssetMasterMutation.isPending,
  };
};
