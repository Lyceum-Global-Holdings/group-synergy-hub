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
      queryClient.invalidateQueries({ queryKey: ['header-locations'] });
    },
  });
};

/**
 * Fetch locations filtered by an array of company IDs using the junction table,
 * with legacy company_id fallback support.
 */
export const useLocationsForCompanies = (companyIds: string[]) => {
  return useQuery({
    queryKey: ['locations-for-companies', companyIds],
    queryFn: async () => {
      if (companyIds.length === 0) return [];

      const [mappedRes, legacyRes] = await Promise.all([
        supabase
          .from('warehouse_location_companies')
          .select('location_id, warehouse_locations!inner(id, name, type)')
          .in('company_id', companyIds)
          .eq('warehouse_locations.type', 'location'),
        supabase
          .from('warehouse_locations')
          .select('id, name, type, company_id')
          .in('company_id', companyIds)
          .eq('type', 'location'),
      ]);

      if (mappedRes.error) throw mappedRes.error;
      if (legacyRes.error) throw legacyRes.error;

      // Deduplicate locations (a location may appear for multiple companies)
      const locationMap = new Map<string, { id: string; name: string }>();

      for (const row of mappedRes.data || []) {
        const loc = row.warehouse_locations as any;
        if (loc?.id && !locationMap.has(loc.id)) {
          locationMap.set(loc.id, { id: loc.id, name: loc.name });
        }
      }

      for (const loc of legacyRes.data || []) {
        if (loc?.id && !locationMap.has(loc.id)) {
          locationMap.set(loc.id, { id: loc.id, name: loc.name });
        }
      }

      return Array.from(locationMap.values()).sort((a, b) => a.name.localeCompare(b.name));
    },
    enabled: companyIds.length > 0,
  });
};
