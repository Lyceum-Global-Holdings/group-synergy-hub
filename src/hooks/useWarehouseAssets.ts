import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { getCachedUser } from "@/lib/currentUser";
import { WarehouseAsset, CreateWarehouseAssetData } from '@/types/warehouse';
import { useToast } from '@/hooks/use-toast';

export const useWarehouseAssets = (companyId?: string) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const {
    data: assets = [],
    isLoading,
    error
  } = useQuery({
    queryKey: ['warehouse-assets', companyId],
    queryFn: async () => {
      // Get locations linked to this company via junction table
      let linkedLocationIds: string[] = [];
      if (companyId) {
        const { data: linkedLocs } = await supabase
          .from('warehouse_location_companies')
          .select('location_id')
          .eq('company_id', companyId);
        linkedLocationIds = linkedLocs?.map(r => r.location_id) || [];
      }

      const allData: WarehouseAsset[] = [];
      const batchSize = 1000;
      let from = 0;
      let keepFetching = true;

      while (keepFetching) {
        let query = supabase
          .from('warehouse_assets')
          .select('*')
          .order('created_at', { ascending: false })
          .range(from, from + batchSize - 1);

        if (companyId) {
          if (linkedLocationIds.length > 0) {
            query = query.or(
              `company_id.eq.${companyId},location_id.in.(${linkedLocationIds.join(',')})`
            );
          } else {
            query = query.eq('company_id', companyId);
          }
        }

        const { data, error } = await query;
        if (error) throw error;

        allData.push(...(data as WarehouseAsset[]));

        if (!data || data.length < batchSize) {
          keepFetching = false;
        } else {
          from += batchSize;
        }
      }

      // Deduplicate in case an asset matches both conditions
      const seen = new Set<string>();
      return allData.filter(a => {
        if (seen.has(a.id)) return false;
        seen.add(a.id);
        return true;
      });
    }
  });

  // Helper to apply company + linked location OR filter
  const applyCompanyFilter = async (query: any) => {
    if (!companyId) return query;
    const { data: linkedLocs } = await supabase
      .from('warehouse_location_companies')
      .select('location_id')
      .eq('company_id', companyId);
    const linkedLocationIds = linkedLocs?.map(r => r.location_id) || [];
    if (linkedLocationIds.length > 0) {
      return query.or(
        `company_id.eq.${companyId},location_id.in.(${linkedLocationIds.join(',')})`
      );
    }
    return query.eq('company_id', companyId);
  };

  // Get accurate counts from server
  const { data: totalCount } = useQuery({
    queryKey: ['warehouse-assets-total-count', companyId],
    queryFn: async () => {
      let query = supabase
        .from('warehouse_assets')
        .select('*', { count: 'exact', head: true });
      query = await applyCompanyFilter(query);
      const { count, error } = await query;
      if (error) throw error;
      return count || 0;
    },
  });

  const { data: activeCount } = useQuery({
    queryKey: ['warehouse-assets-active-count', companyId],
    queryFn: async () => {
      let query = supabase
        .from('warehouse_assets')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'active');
      query = await applyCompanyFilter(query);
      const { count, error } = await query;
      if (error) throw error;
      return count || 0;
    },
  });

  const { data: maintenanceCount } = useQuery({
    queryKey: ['warehouse-assets-maintenance-count', companyId],
    queryFn: async () => {
      let query = supabase
        .from('warehouse_assets')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'maintenance');
      query = await applyCompanyFilter(query);
      const { count, error } = await query;
      if (error) throw error;
      return count || 0;
    },
  });

  const createAssetMutation = useMutation({
    mutationFn: async (assetData: CreateWarehouseAssetData) => {
      const user = getCachedUser();
      if (!user) throw new Error('User not authenticated');

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
      const { data, error } = await supabase
        .from('warehouse_assets')
        .delete()
        .eq('id', id)
        .select('id');

      if (error) throw error;
      if (!data || data.length === 0) {
        throw new Error('Asset could not be deleted. You may not have permission.');
      }
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
        description: error.message || "Failed to delete asset",
        variant: "destructive",
      });
    }
  });

  const deleteBulkAssetsMutation = useMutation({
    mutationFn: async (assetIds: string[]) => {
      const { data, error } = await supabase
        .from('warehouse_assets')
        .delete()
        .in('id', assetIds)
        .select('id');

      if (error) throw error;
      if (!data || data.length === 0) {
        throw new Error('Assets could not be deleted. You may not have permission.');
      }
      if (data.length < assetIds.length) {
        throw new Error(
          `Only ${data.length} of ${assetIds.length} assets were deleted. Some assets may require admin permission.`
        );
      }
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
        description: error.message || "Failed to delete assets",
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
      const user = getCachedUser();
      if (!user) throw new Error('User not authenticated');

      const assetsWithUser = assetsData.map(asset => ({
        ...asset,
        category_id: asset.category_id || null,
        subcategory_id: asset.subcategory_id && asset.subcategory_id !== "none" ? asset.subcategory_id : null,
        location_id: asset.location_id && asset.location_id !== "none" ? asset.location_id : null,
        sublocation_id: asset.sublocation_id && asset.sublocation_id !== "none" ? asset.sublocation_id : null,
        department_id: asset.department_id && asset.department_id !== "none" ? asset.department_id : null,
        purchase_date: asset.purchase_date || null,
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
