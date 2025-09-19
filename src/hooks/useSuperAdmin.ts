import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/**
 * Hook to check if the current user is a super admin
 * Super admins have access to all modules and companies
 */
export const useSuperAdmin = () => {
  return useQuery({
    queryKey: ['super-admin-status'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return false;

      const { data, error } = await supabase
        .rpc('is_super_admin', { _user_id: user.id });

      if (error) {
        console.error('Error checking super admin status:', error);
        return false;
      }

      return data === true;
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
};

/**
 * Hook to check if user has admin privileges (admin or super_admin)
 */
export const useIsAdmin = () => {
  return useQuery({
    queryKey: ['admin-status'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return false;

      const { data, error } = await supabase
        .rpc('is_admin', { _user_id: user.id });

      if (error) {
        console.error('Error checking admin status:', error);
        return false;
      }

      return data === true;
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
};

/**
 * Utility function to determine if a user should have access to all companies
 * This can be used throughout the app for conditional access control
 */
export const hasUniversalAccess = (isSuperAdmin: boolean) => {
  return isSuperAdmin;
};