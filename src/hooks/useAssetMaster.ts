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
      const { data, error } = await supabase
        .from('asset_master')
        .update(assetData)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['asset-master'] });
      toast({
        title: "Success",
        description: "Asset master item updated successfully",
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
