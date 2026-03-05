import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

/**
 * Fetches the current logged-in user's location permissions.
 * Admins and Super Admins automatically get viewAllLocations = true.
 */
export const useCurrentUserLocationPermissions = () => {
  const { user } = useAuth();
  const userId = user?.id;

  return useQuery({
    queryKey: ['current-user-location-permissions', userId],
    queryFn: async () => {
      if (!userId) return { viewAllLocations: false, viewLocationIds: [] as string[], editLocationIds: [] as string[] };

      // Check admin status, profile flag, and permissions in parallel
      const [adminRes, superAdminRes, profileRes, permRes] = await Promise.all([
        supabase.rpc('is_admin', { _user_id: userId }),
        supabase.rpc('is_super_admin', { _user_id: userId }),
        supabase
          .from('profiles')
          .select('view_all_locations')
          .eq('user_id', userId)
          .maybeSingle(),
        supabase
          .from('user_location_permissions')
          .select('location_id, permission_type')
          .eq('user_id', userId),
      ]);

      if (profileRes.error) throw profileRes.error;
      if (permRes.error) throw permRes.error;

      const isAdmin = adminRes.data === true;
      const isSuperAdmin = superAdminRes.data === true;

      // Admins/Super Admins always see all locations
      if (isAdmin || isSuperAdmin) {
        return { viewAllLocations: true, viewLocationIds: [] as string[], editLocationIds: [] as string[] };
      }

      const viewAllLocations = profileRes.data?.view_all_locations ?? false;
      const viewLocationIds: string[] = [];
      const editLocationIds: string[] = [];

      for (const row of permRes.data || []) {
        if (row.permission_type === 'view') viewLocationIds.push(row.location_id);
        if (row.permission_type === 'edit') editLocationIds.push(row.location_id);
      }

      return { viewAllLocations, viewLocationIds, editLocationIds };
    },
    enabled: !!userId,
    staleTime: 5 * 60 * 1000,
  });
};
