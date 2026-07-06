import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { getCachedUser } from "@/lib/currentUser";
import { WarehouseBin, CreateWarehouseBinData } from '@/types/itemBin';
import { useToast } from '@/hooks/use-toast';
import { useCurrentUserLocationPermissions } from '@/hooks/useCurrentUserLocationPermissions';

interface UseWarehouseBinsOptions {
  skipLocationFilter?: boolean;
}

export const useWarehouseBins = (options: UseWarehouseBinsOptions = {}) => {
  const { skipLocationFilter = false } = options;
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: permissions } = useCurrentUserLocationPermissions();

  const {
    data: bins = [],
    isLoading,
    error
  } = useQuery({
    queryKey: ['warehouse-bins', skipLocationFilter, permissions?.viewAllLocations, permissions?.viewLocationIds, permissions?.editLocationIds],
    queryFn: async () => {
      let query = supabase
        .from('warehouse_bins')
        .select('*')
        .order('bin_code');

      // Filter by permitted locations if user doesn't have view_all_locations
      // Skip filtering when skipLocationFilter is true (e.g., during transfers)
      if (!skipLocationFilter && permissions && !permissions.viewAllLocations) {
        const permittedLocationIds = [...new Set([...permissions.viewLocationIds, ...permissions.editLocationIds])];
        if (permittedLocationIds.length > 0) {
          query = query.in('location_id', permittedLocationIds);
        }
        // No else — show all bins when no location permissions configured
      }

      const { data, error } = await query;

      if (error) throw error;

      // Defensive dedupe: one bin per (location_id, lower(bin_code)).
      // DB now enforces this with a unique index, but we dedupe client-side
      // too in case of stale cache or in-flight writes.
      const seen = new Map<string, WarehouseBin>();
      for (const b of (data ?? []) as WarehouseBin[]) {
        const key = `${b.location_id ?? ''}::${(b.bin_code ?? '').toLowerCase()}`;
        const existing = seen.get(key);
        // Prefer the company-scoped row over a NULL-company template.
        if (!existing || (!existing.company_id && b.company_id)) {
          seen.set(key, b);
        }
      }

      // Natural sort: "1-B-2-2" comes before "1-B-2-10".
      const collator = new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' });
      return Array.from(seen.values()).sort((a, b) =>
        collator.compare(a.bin_code ?? '', b.bin_code ?? '')
      );
    },
  });

  const createBinMutation = useMutation({
    mutationFn: async (binData: CreateWarehouseBinData) => {
      const user = getCachedUser();
      if (!user) throw new Error('User not authenticated');

      const { location_ids, location_id, is_global_template, ...rest } = binData;
      const targets = location_ids && location_ids.length > 0 ? location_ids : [location_id];
      const rows = targets
        .filter((id): id is string => !!id)
        .map((lid) => ({
          ...rest,
          location_id: lid,
          is_global_template: !!is_global_template || (location_ids?.length ?? 0) > 1,
          created_by: user.id,
        }));

      if (rows.length === 0) throw new Error('At least one location is required');

      const { data, error } = await supabase
        .from('warehouse_bins')
        .insert(rows)
        .select();

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['warehouse-bins'] });
      const count = Array.isArray(data) ? data.length : 1;
      toast({
        title: "Success",
        description: count > 1 ? `${count} bins created across locations` : "Bin created successfully",
      });
    },
    onError: (error) => {
      console.error('Error creating bin:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to create bin",
        variant: "destructive",
      });
    }
  });

  const updateBinMutation = useMutation({
    mutationFn: async ({ id, ...binData }: Partial<WarehouseBin> & { id: string }) => {
      const { data, error } = await supabase
        .from('warehouse_bins')
        .update(binData)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['warehouse-bins'] });
      toast({
        title: "Success",
        description: "Bin updated successfully",
      });
    },
    onError: (error) => {
      console.error('Error updating bin:', error);
      toast({
        title: "Error",
        description: "Failed to update bin",
        variant: "destructive",
      });
    }
  });

  const deleteBinMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('warehouse_bins')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['warehouse-bins'] });
      toast({
        title: "Success",
        description: "Bin deleted successfully",
      });
    },
    onError: (error) => {
      console.error('Error deleting bin:', error);
      toast({
        title: "Error",
        description: "Failed to delete bin",
        variant: "destructive",
      });
    }
  });

  return {
    bins,
    isLoading,
    error,
    createBin: createBinMutation.mutate,
    updateBin: updateBinMutation.mutate,
    deleteBin: deleteBinMutation.mutate,
    isCreating: createBinMutation.isPending,
    isUpdating: updateBinMutation.isPending,
    isDeleting: deleteBinMutation.isPending,
  };
};
