import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { AssetMasterPurchaseHistory, CreatePurchaseHistoryData } from '@/types/assetMaster';
import { useToast } from '@/hooks/use-toast';

export const useAssetMasterPurchaseHistory = (assetMasterId?: string) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const {
    data: purchaseHistory = [],
    isLoading,
    error
  } = useQuery({
    queryKey: ['asset-master-purchase-history', assetMasterId],
    queryFn: async () => {
      if (!assetMasterId) return [];

      const { data, error } = await supabase
        .from('asset_master_purchase_history')
        .select('*')
        .eq('asset_master_id', assetMasterId)
        .order('purchase_date', { ascending: false });

      if (error) throw error;
      return data as AssetMasterPurchaseHistory[];
    },
    enabled: !!assetMasterId
  });

  const createPurchaseHistoryMutation = useMutation({
    mutationFn: async (historyData: CreatePurchaseHistoryData) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      const { data, error } = await supabase
        .from('asset_master_purchase_history')
        .insert({
          ...historyData,
          created_by: user.id
        })
        .select()
        .single();

      if (error) throw error;

      // Update the asset_master purchase_price with the latest price
      const { error: updateError } = await supabase
        .from('asset_master')
        .update({ purchase_price: historyData.purchase_price })
        .eq('id', historyData.asset_master_id);

      if (updateError) throw updateError;

      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['asset-master-purchase-history', variables.asset_master_id] });
      queryClient.invalidateQueries({ queryKey: ['asset-master'] });
      toast({
        title: "Success",
        description: "Purchase history added successfully",
      });
    },
    onError: (error) => {
      console.error('Error creating purchase history:', error);
      toast({
        title: "Error",
        description: "Failed to add purchase history",
        variant: "destructive",
      });
    }
  });

  const deletePurchaseHistoryMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('asset_master_purchase_history')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['asset-master-purchase-history'] });
      toast({
        title: "Success",
        description: "Purchase history deleted successfully",
      });
    },
    onError: (error) => {
      console.error('Error deleting purchase history:', error);
      toast({
        title: "Error",
        description: "Failed to delete purchase history",
        variant: "destructive",
      });
    }
  });

  return {
    purchaseHistory,
    isLoading,
    error,
    createPurchaseHistory: createPurchaseHistoryMutation.mutate,
    deletePurchaseHistory: deletePurchaseHistoryMutation.mutate,
    isCreating: createPurchaseHistoryMutation.isPending,
    isDeleting: deletePurchaseHistoryMutation.isPending,
  };
};
