import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { WarehouseLocation, CreateWarehouseLocationData, WarehouseCategory } from '@/types/warehouse';
import { useToast } from '@/hooks/use-toast';

export const useWarehouseLocations = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const {
    data: locations = [],
    isLoading,
    error
  } = useQuery({
    queryKey: ['warehouse-locations'],
    queryFn: async () => {
      console.log('Fetching warehouse locations...');
      
      const { data, error } = await supabase
        .from('warehouse_locations')
        .select('*')
        .order('created_at', { ascending: true });

      if (error) {
        console.error('Error fetching locations:', error);
        throw error;
      }
      
      console.log('Fetched locations:', data);
      return data as WarehouseLocation[];
    }
  });

  const invalidateLocationQueries = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['warehouse-locations'] }),
      queryClient.invalidateQueries({ queryKey: ['effective-locations-for-company'] }),
      queryClient.invalidateQueries({ queryKey: ['effective-locations-for-companies'] }),
      queryClient.invalidateQueries({ queryKey: ['dashboard-locations'] }),
      queryClient.invalidateQueries({ queryKey: ['locations-for-companies'] }),
      queryClient.invalidateQueries({ queryKey: ['location-companies'] }),
      queryClient.invalidateQueries({ queryKey: ['stock-bearing-locations-for-company'] }),
      queryClient.invalidateQueries({ queryKey: ['company-inventory-at-location'] }),
    ]);
  };

  const createLocationMutation = useMutation({
    mutationFn: async (locationData: CreateWarehouseLocationData) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      const { data, error } = await supabase
        .from('warehouse_locations')
        .insert({
          ...locationData,
          created_by: user.id
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: async () => {
      await invalidateLocationQueries();
      toast({
        title: "Success",
        description: "Location created successfully",
      });
    },
    onError: (error) => {
      console.error('Error creating location:', error);
      toast({
        title: "Error",
        description: "Failed to create location",
        variant: "destructive",
      });
    }
  });

  const updateLocationMutation = useMutation({
    mutationFn: async ({ id, ...locationData }: Partial<WarehouseLocation> & { id: string }) => {
      const { data, error } = await supabase
        .from('warehouse_locations')
        .update(locationData)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: async () => {
      await invalidateLocationQueries();
      toast({
        title: "Success",
        description: "Location updated successfully",
      });
    },
    onError: (error) => {
      console.error('Error updating location:', error);
      toast({
        title: "Error",
        description: "Failed to update location",
        variant: "destructive",
      });
    }
  });

  const deleteLocationMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('warehouse_locations')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: async () => {
      await invalidateLocationQueries();
      toast({
        title: "Success",
        description: "Location deleted successfully",
      });
    },
    onError: (error) => {
      console.error('Error deleting location:', error);
      toast({
        title: "Error",
        description: "Failed to delete location",
        variant: "destructive",
      });
    }
  });

  const bulkDeleteLocationsMutation = useMutation({
    mutationFn: async (ids: string[]) => {
      const { error } = await supabase
        .from('warehouse_locations')
        .delete()
        .in('id', ids);

      if (error) throw error;
    },
    onSuccess: async () => {
      await invalidateLocationQueries();
    },
    onError: (error) => {
      console.error('Error bulk deleting locations:', error);
      throw error;
    }
  });

  const bulkUpdateStatusMutation = useMutation({
    mutationFn: async ({ ids, status }: { ids: string[]; status: string }) => {
      const { error } = await supabase
        .from('warehouse_locations')
        .update({ status })
        .in('id', ids);

      if (error) throw error;
    },
    onSuccess: async () => {
      await invalidateLocationQueries();
    },
    onError: (error) => {
      console.error('Error bulk updating status:', error);
      throw error;
    }
  });

  const getLocationsByCategory = (categories: WarehouseCategory[]) => {
    return locations?.filter(loc => 
      loc.warehouse_category && categories.includes(loc.warehouse_category)
    ) || [];
  };

  return {
    locations,
    isLoading,
    error,
    createLocation: createLocationMutation.mutateAsync,
    updateLocation: updateLocationMutation.mutate,
    updateLocationAsync: updateLocationMutation.mutateAsync,
    deleteLocation: deleteLocationMutation.mutate,
    deleteLocationAsync: deleteLocationMutation.mutateAsync,
    bulkDeleteLocations: bulkDeleteLocationsMutation.mutateAsync,
    bulkUpdateStatus: (ids: string[], status: string) => bulkUpdateStatusMutation.mutateAsync({ ids, status }),
    getLocationsByCategory,
    isCreating: createLocationMutation.isPending,
    isUpdating: updateLocationMutation.isPending,
    isDeleting: deleteLocationMutation.isPending,
  };
};

export interface EffectiveLocation {
  id: string;
  name: string;
  type: string;
  parent_id: string | null;
  depth?: number;
  is_standalone_warehouse?: boolean;
}

/**
 * Canonical company-scoped effective-location resolver.
 * Server-side resolves explicit + inherit_parent chains via SECURITY DEFINER RPC.
 * No client-side fallback to unrelated top-level locations.
 * ISO 8000 master-data integrity / SAP EWM hierarchy alignment.
 */
export const useEffectiveLocationsForCompany = (selectedCompanyId?: string | null) => {
  return useQuery({
    queryKey: ['effective-locations-for-company', selectedCompanyId],
    queryFn: async (): Promise<EffectiveLocation[]> => {
      if (!selectedCompanyId) return [];
      const { data, error } = await supabase.rpc(
        'get_effective_locations_for_company' as any,
        { p_company_id: selectedCompanyId }
      );
      if (error) throw error;
      return ((data as any[]) || []) as EffectiveLocation[];
    },
    enabled: !!selectedCompanyId,
  });
};

/**
 * Multi-company variant. Used by admin/user-permission editors and any
 * dropdown that must union locations across several companies.
 */
export const useEffectiveLocationsForCompanies = (companyIds: string[]) => {
  return useQuery({
    queryKey: ['effective-locations-for-companies', [...companyIds].sort()],
    queryFn: async (): Promise<EffectiveLocation[]> => {
      if (!companyIds || companyIds.length === 0) return [];
      const { data, error } = await supabase.rpc(
        'get_effective_locations_for_companies' as any,
        { p_company_ids: companyIds }
      );
      if (error) throw error;
      return ((data as any[]) || []) as EffectiveLocation[];
    },
    enabled: companyIds.length > 0,
  });
};

/** Dashboard location filter — strict company-scoped, no fallback. */
export const useDashboardLocations = (selectedCompanyId?: string | null) => {
  return useQuery({
    queryKey: ['dashboard-locations', selectedCompanyId],
    queryFn: async (): Promise<EffectiveLocation[]> => {
      if (!selectedCompanyId) {
        const { data, error } = await supabase
          .from('warehouse_locations')
          .select('id, name, type, parent_id')
          .order('name');
        if (error) throw error;
        return (data as EffectiveLocation[]) ?? [];
      }

      const { data, error } = await supabase.rpc(
        'get_effective_locations_for_company' as any,
        { p_company_id: selectedCompanyId }
      );
      if (error) throw error;
      return ((data as any[]) || []) as EffectiveLocation[];
    },
  });
};

/**
 * Stock-bearing locations for a company. Returns ALL nodes (location, sublocation,
 * department) where the company has effective access — including standalone
 * sub-location warehouses. Use this for stock-add / GRN / transfer pickers.
 * SAP EWM: any storage node can be a stocking warehouse.
 */
export const useStockBearingLocationsForCompany = (selectedCompanyId?: string | null) => {
  return useQuery({
    queryKey: ['stock-bearing-locations-for-company', selectedCompanyId],
    queryFn: async (): Promise<EffectiveLocation[]> => {
      if (!selectedCompanyId) return [];
      const { data, error } = await supabase.rpc(
        'get_stock_bearing_locations_for_company' as any,
        { p_company_id: selectedCompanyId }
      );
      if (error) throw error;
      return ((data as any[]) || []) as EffectiveLocation[];
    },
    enabled: !!selectedCompanyId,
  });
};

/**
 * Per-company inventory at a specific physical location. Guarantees per-company
 * stock isolation when many companies share a sub-location (standalone warehouse).
 * Server-side filters warehouse_items by both company_id and location_id.
 */
export const useCompanyInventoryAtLocation = (
  companyId?: string | null,
  locationId?: string | null
) => {
  return useQuery({
    queryKey: ['company-inventory-at-location', companyId, locationId],
    queryFn: async (): Promise<any[]> => {
      if (!companyId || !locationId) return [];
      const { data, error } = await supabase.rpc(
        'get_company_inventory_at_location' as any,
        { p_company_id: companyId, p_location_id: locationId }
      );
      if (error) throw error;
      return (data as any[]) || [];
    },
    enabled: !!companyId && !!locationId,
  });
};