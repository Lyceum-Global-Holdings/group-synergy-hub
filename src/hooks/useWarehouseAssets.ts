import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { WarehouseAsset, CreateWarehouseAssetData } from '@/types/warehouse';
import { useToast } from '@/hooks/use-toast';

export const useWarehouseAssets = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const {
    data: assets = [],
    isLoading,
    error
  } = useQuery({
    queryKey: ['warehouse-assets'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('warehouse_assets')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(10000);

      if (error) throw error;
      return data as WarehouseAsset[];
    }
  });

  // Get accurate counts from server
  const { data: totalCount } = useQuery({
    queryKey: ['warehouse-assets-total-count'],
    queryFn: async () => {
      const { count, error } = await supabase
        .from('warehouse_assets')
        .select('*', { count: 'exact', head: true });
      
      if (error) throw error;
      return count || 0;
    },
    
  });

  const { data: activeCount } = useQuery({
    queryKey: ['warehouse-assets-active-count'],
    queryFn: async () => {
      const { count, error } = await supabase
        .from('warehouse_assets')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'active');
      
      if (error) throw error;
      return count || 0;
    },
  
  });

  const { data: maintenanceCount } = useQuery({
    queryKey: ['warehouse-assets-maintenance-count'],
    queryFn: async () => {
      const { count, error } = await supabase
        .from('warehouse_assets')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'maintenance');
      
      if (error) throw error;
      return count || 0;
    },
    
  });

  const createAssetMutation = useMutation({
    mutationFn: async (assetData: CreateWarehouseAssetData) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      // Sanitize UUID fields - convert "none" or empty strings to null
      const sanitizedData = {
        ...assetData,
        category_id: assetData.category_id || null,
        subcategory_id: assetData.subcategory_id && assetData.subcategory_id !== "none" ? assetData.subcategory_id : null,
        location_id: assetData.location_id && assetData.location_id !== "none" ? assetData.location_id : null,
        sublocation_id: assetData.sublocation_id && assetData.sublocation_id !== "none" ? assetData.sublocation_id : null,
        department_id: assetData.department_id && assetData.department_id !== "none" ? assetData.department_id : null,
        created_by: user.id
      };

      const { data, error } = await supabase
        .from('warehouse_assets')
        .insert(sanitizedData)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['warehouse-assets'] });
      queryClient.invalidateQueries({ queryKey: ['warehouse-assets-total-count'] });
      queryClient.invalidateQueries({ queryKey: ['warehouse-assets-active-count'] });
      queryClient.invalidateQueries({ queryKey: ['warehouse-assets-maintenance-count'] });
      toast({
        title: "Success",
        description: "Asset created successfully",
      });
    },
    onError: (error) => {
      console.error('Error creating asset:', error);
      toast({
        title: "Error",
        description: "Failed to create asset",
        variant: "destructive",
      });
    }
  });

  const updateAssetMutation = useMutation({
    mutationFn: async ({ id, ...assetData }: Partial<WarehouseAsset> & { id: string }) => {
      const { data, error } = await supabase
        .from('warehouse_assets')
        .update(assetData)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['warehouse-assets'] });
      queryClient.invalidateQueries({ queryKey: ['warehouse-assets-total-count'] });
      queryClient.invalidateQueries({ queryKey: ['warehouse-assets-active-count'] });
      queryClient.invalidateQueries({ queryKey: ['warehouse-assets-maintenance-count'] });
      toast({
        title: "Success",
        description: "Asset updated successfully",
      });
    },
    onError: (error) => {
      console.error('Error updating asset:', error);
      toast({
        title: "Error",
        description: "Failed to update asset",
        variant: "destructive",
      });
    }
  });

  const deleteAssetMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('warehouse_assets')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['warehouse-assets'] });
      queryClient.invalidateQueries({ queryKey: ['warehouse-assets-total-count'] });
      queryClient.invalidateQueries({ queryKey: ['warehouse-assets-active-count'] });
      queryClient.invalidateQueries({ queryKey: ['warehouse-assets-maintenance-count'] });
      toast({
        title: "Success",
        description: "Asset deleted successfully",
      });
    },
    onError: (error) => {
      console.error('Error deleting asset:', error);
      toast({
        title: "Error",
        description: "Failed to delete asset",
        variant: "destructive",
      });
    }
  });

  const deleteBulkAssetsMutation = useMutation({
    mutationFn: async (assetIds: string[]) => {
      const { error } = await supabase
        .from('warehouse_assets')
        .delete()
        .in('id', assetIds);

      if (error) throw error;
    },
    onSuccess: (_, assetIds) => {
      queryClient.invalidateQueries({ queryKey: ['warehouse-assets'] });
      queryClient.invalidateQueries({ queryKey: ['warehouse-assets-total-count'] });
      queryClient.invalidateQueries({ queryKey: ['warehouse-assets-active-count'] });
      queryClient.invalidateQueries({ queryKey: ['warehouse-assets-maintenance-count'] });
      toast({
        title: "Success",
        description: `Successfully deleted ${assetIds.length} assets`,
      });
    },
    onError: (error) => {
      console.error('Error deleting assets:', error);
      toast({
        title: "Error",
        description: "Failed to delete assets",
        variant: "destructive",
      });
    }
  });

  const updateBulkAssetsMutation = useMutation({
    mutationFn: async ({ 
      assetIds, 
      updateData 
    }: { 
      assetIds: string[], 
      updateData: Partial<WarehouseAsset> 
    }) => {
      const { data, error } = await supabase
        .from('warehouse_assets')
        .update(updateData)
        .in('id', assetIds)
        .select();
      
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['warehouse-assets'] });
      queryClient.invalidateQueries({ queryKey: ['warehouse-assets-total-count'] });
      queryClient.invalidateQueries({ queryKey: ['warehouse-assets-active-count'] });
      queryClient.invalidateQueries({ queryKey: ['warehouse-assets-maintenance-count'] });
      toast({
        title: "Success",
        description: `Successfully updated ${data.length} asset${data.length > 1 ? 's' : ''}`,
      });
    },
    onError: (error) => {
      console.error('Error updating assets:', error);
      toast({
        title: "Error",
        description: "Failed to update assets",
        variant: "destructive",
      });
    }
  });

  const createBulkAssetsMutation = useMutation({
    mutationFn: async (assetsData: CreateWarehouseAssetData[]) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      // Sanitize each asset's UUID fields and date/numeric fields
      const assetsWithUser = assetsData.map(asset => ({
        ...asset,
        // UUID field sanitization
        category_id: asset.category_id || null,
        subcategory_id: asset.subcategory_id && asset.subcategory_id !== "none" ? asset.subcategory_id : null,
        location_id: asset.location_id && asset.location_id !== "none" ? asset.location_id : null,
        sublocation_id: asset.sublocation_id && asset.sublocation_id !== "none" ? asset.sublocation_id : null,
        department_id: asset.department_id && asset.department_id !== "none" ? asset.department_id : null,
        // Date field sanitization - convert empty strings to null
        purchase_date: asset.purchase_date || null,
        // Numeric field sanitization
        purchase_price: asset.purchase_price ?? null,
        current_value: asset.current_value ?? null,
        created_by: user.id
      }));

      const { data, error } = await supabase
        .from('warehouse_assets')
        .insert(assetsWithUser)
        .select();

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['warehouse-assets'] });
      queryClient.invalidateQueries({ queryKey: ['warehouse-assets-total-count'] });
      queryClient.invalidateQueries({ queryKey: ['warehouse-assets-active-count'] });
      queryClient.invalidateQueries({ queryKey: ['warehouse-assets-maintenance-count'] });
      toast({
        title: "Success",
        description: `Successfully created ${data.length} assets`,
      });
    },
    onError: (error) => {
      console.error('Error creating bulk assets:', error);
      toast({
        title: "Error",
        description: "Failed to create assets in bulk",
        variant: "destructive",
      });
    }
  });

  return {
    assets,
    isLoading,
    error,
    totalCount,
    activeCount,
    maintenanceCount,
    createAsset: createAssetMutation.mutate,
    createAssetAsync: createAssetMutation.mutateAsync,
    updateAsset: updateAssetMutation.mutate,
    deleteAsset: deleteAssetMutation.mutate,
    deleteBulkAssets: deleteBulkAssetsMutation.mutate,
    updateBulkAssets: updateBulkAssetsMutation.mutate,
    createBulkAssets: createBulkAssetsMutation.mutate,
    createBulkAssetsAsync: createBulkAssetsMutation.mutateAsync,
    isCreating: createAssetMutation.isPending,
    isUpdating: updateAssetMutation.isPending,
    isDeleting: deleteAssetMutation.isPending,
    isDeletingBulk: deleteBulkAssetsMutation.isPending,
    isUpdatingBulk: updateBulkAssetsMutation.isPending,
    isCreatingBulk: createBulkAssetsMutation.isPending,
  };
};