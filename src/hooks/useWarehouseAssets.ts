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
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as WarehouseAsset[];
    }
  });

  const createAssetMutation = useMutation({
    mutationFn: async (assetData: CreateWarehouseAssetData) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      const { data, error } = await supabase
        .from('warehouse_assets')
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
      queryClient.invalidateQueries({ queryKey: ['warehouse-assets'] });
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

      const assetsWithUser = assetsData.map(asset => ({
        ...asset,
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
    createAsset: createAssetMutation.mutate,
    updateAsset: updateAssetMutation.mutate,
    deleteAsset: deleteAssetMutation.mutate,
    deleteBulkAssets: deleteBulkAssetsMutation.mutate,
    updateBulkAssets: updateBulkAssetsMutation.mutate,
    createBulkAssets: createBulkAssetsMutation.mutate,
    isCreating: createAssetMutation.isPending,
    isUpdating: updateAssetMutation.isPending,
    isDeleting: deleteAssetMutation.isPending,
    isDeletingBulk: deleteBulkAssetsMutation.isPending,
    isUpdatingBulk: updateBulkAssetsMutation.isPending,
    isCreatingBulk: createBulkAssetsMutation.isPending,
  };
};