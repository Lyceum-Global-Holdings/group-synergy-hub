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
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['warehouse-locations'] });
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
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['warehouse-locations'] });
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
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['warehouse-locations'] });
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
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['warehouse-locations'] });
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
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['warehouse-locations'] });
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
    deleteLocation: deleteLocationMutation.mutate,
    bulkDeleteLocations: bulkDeleteLocationsMutation.mutateAsync,
    bulkUpdateStatus: (ids: string[], status: string) => bulkUpdateStatusMutation.mutateAsync({ ids, status }),
    getLocationsByCategory,
    isCreating: createLocationMutation.isPending,
    isUpdating: updateLocationMutation.isPending,
    isDeleting: deleteLocationMutation.isPending,
  };
};

/** Lightweight hook for dashboard location filter — includes shared (null company_id) locations */
export const useDashboardLocations = (selectedCompanyId?: string | null) => {
  return useQuery({
    queryKey: ['dashboard-locations', selectedCompanyId],
    queryFn: async () => {
      let query = supabase
        .from('warehouse_locations')
        .select('id, name, type')
        .order('name');

      if (selectedCompanyId) {
        query = query.or(`company_id.eq.${selectedCompanyId},company_id.is.null`);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
  });
};