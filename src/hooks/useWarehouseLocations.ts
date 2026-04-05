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
      queryClient.invalidateQueries({ queryKey: ['header-locations'] }),
      queryClient.invalidateQueries({ queryKey: ['dashboard-locations'] }),
      queryClient.invalidateQueries({ queryKey: ['location-companies'] }),
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

/** Lightweight hook for dashboard location filter */
export const useDashboardLocations = (selectedCompanyId?: string | null) => {
  return useQuery({
    queryKey: ['dashboard-locations', selectedCompanyId],
    queryFn: async () => {
      if (!selectedCompanyId) {
        const { data, error } = await supabase
          .from('warehouse_locations')
          .select('id, name, type')
          .order('name');

        if (error) throw error;
        return data;
      }

      const [{ data: mappedRows, error: mappedError }, { data: legacyRows, error: legacyError }] = await Promise.all([
        supabase
          .from('warehouse_location_companies')
          .select('warehouse_locations!inner(id, name, type)')
          .eq('company_id', selectedCompanyId),
        supabase
          .from('warehouse_locations')
          .select('id, name, type')
          .or(`company_id.eq.${selectedCompanyId},company_id.is.null`),
      ]);

      if (mappedError) throw mappedError;
      if (legacyError) throw legacyError;

      const merged = new Map<string, { id: string; name: string; type: string }>();

      (mappedRows || []).forEach((row: any) => {
        const loc = row.warehouse_locations;
        if (loc?.id) merged.set(loc.id, loc);
      });

      (legacyRows || []).forEach((loc: any) => {
        if (loc?.id) merged.set(loc.id, loc);
      });

      const result = Array.from(merged.values()).sort((a, b) => a.name.localeCompare(b.name));

      // Fallback: if no locations mapped to this company, show all locations
      if (result.length === 0) {
        const { data: allLocations, error: allError } = await supabase
          .from('warehouse_locations')
          .select('id, name, type')
          .eq('type', 'location')
          .order('name');
        if (allError) throw allError;
        return allLocations ?? [];
      }

      return result;
    },
  });
};