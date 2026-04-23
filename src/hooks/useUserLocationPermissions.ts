import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface UserLocationPermission {
  id: string;
  user_id: string;
  location_id: string;
  permission_type: 'view' | 'edit';
  created_at: string;
  updated_at: string;
}

export const useUserLocationPermissions = (userId: string | undefined) => {
  return useQuery({
    queryKey: ['user-location-permissions', userId],
    queryFn: async () => {
      if (!userId) return [];
      const { data, error } = await supabase
        .from('user_location_permissions')
        .select('*')
        .eq('user_id', userId);
      if (error) throw error;
      return data as UserLocationPermission[];
    },
    enabled: !!userId,
  });
};

export const useUserViewAllLocations = (userId: string | undefined) => {
  return useQuery({
    queryKey: ['user-view-all-locations', userId],
    queryFn: async () => {
      if (!userId) return false;
      const { data, error } = await supabase
        .from('profiles')
        .select('view_all_locations')
        .eq('user_id', userId)
        .maybeSingle();
      if (error) throw error;
      return data?.view_all_locations ?? false;
    },
    enabled: !!userId,
  });
};

export const useSaveUserLocationPermissions = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      userId,
      viewLocationIds,
      editLocationIds,
      viewAllLocations,
    }: {
      userId: string;
      viewLocationIds: string[];
      editLocationIds: string[];
      viewAllLocations: boolean;
    }) => {
      // Update view_all_locations flag
      const { error: profileError } = await supabase
        .from('profiles')
        .update({ view_all_locations: viewAllLocations })
        .eq('user_id', userId);
      if (profileError) throw profileError;

      // Delete existing permissions
      const { error: deleteError } = await supabase
        .from('user_location_permissions')
        .delete()
        .eq('user_id', userId);
      if (deleteError) throw deleteError;

      // Build new permissions
      const records: { user_id: string; location_id: string; permission_type: string }[] = [];
      
      for (const locId of viewLocationIds) {
        records.push({ user_id: userId, location_id: locId, permission_type: 'view' });
      }
      for (const locId of editLocationIds) {
        records.push({ user_id: userId, location_id: locId, permission_type: 'edit' });
      }

      if (records.length > 0) {
        const { error: insertError } = await supabase
          .from('user_location_permissions')
          .insert(records);
        if (insertError) throw insertError;
      }
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['user-location-permissions', variables.userId] });
      queryClient.invalidateQueries({ queryKey: ['user-view-all-locations', variables.userId] });
      queryClient.invalidateQueries({ queryKey: ['current-user-location-permissions'] });
      queryClient.invalidateQueries({ queryKey: ['effective-locations-for-company'] });
      queryClient.invalidateQueries({ queryKey: ['effective-locations-for-companies'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-locations'] });
      queryClient.invalidateQueries({ queryKey: ['locations-for-companies'] });
    },
  });
};

/**
 * Fetch effective locations for an array of company IDs via the canonical
 * server-side resolver. Returns the union of all locations (top-level,
 * sub-locations, departments, including inherited children) effectively
 * mapped to any of the supplied companies.
 */
export const useLocationsForCompanies = (companyIds: string[]) => {
  return useQuery({
    queryKey: ['locations-for-companies', [...companyIds].sort()],
    queryFn: async () => {
      if (companyIds.length === 0) return [];

      const { data, error } = await supabase.rpc(
        'get_effective_locations_for_companies' as any,
        { p_company_ids: companyIds }
      );
      if (error) throw error;

      const rows = ((data as any[]) || []) as Array<{
        id: string;
        name: string;
        type: string;
        parent_id: string | null;
      }>;

      // Deduplicate (RPC already does, but defensive) and sort by name.
      const seen = new Map<string, { id: string; name: string }>();
      for (const r of rows) {
        if (r?.id && !seen.has(r.id)) seen.set(r.id, { id: r.id, name: r.name });
      }
      return Array.from(seen.values()).sort((a, b) => a.name.localeCompare(b.name));
    },
    enabled: companyIds.length > 0,
  });
};

