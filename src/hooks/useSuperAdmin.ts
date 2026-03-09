import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

/**
 * Hook to check if the current user is a super admin
 * Super admins have access to all modules and companies
 */
export const useSuperAdmin = () => {
  const { user, loading: authLoading } = useAuth();

  return useQuery({
    queryKey: ["super-admin-status", user?.id],
    enabled: !authLoading,
    queryFn: async () => {
      if (!user) return false;

      // Primary check via security-definer RPC
      const { data: isSuperAdminRpc, error: rpcError } = await supabase.rpc("is_super_admin", {
        _user_id: user.id,
      });

      if (!rpcError && isSuperAdminRpc === true) {
        return true;
      }

      // Fallback #1: generic role-check RPC
      const { data: hasSuperRole, error: hasRoleError } = await supabase.rpc("has_role", {
        _user_id: user.id,
        _app_role: "super_admin",
      });

      if (!hasRoleError && hasSuperRole === true) {
        return true;
      }

      // Fallback #2: direct role join (for resilience when RPCs temporarily fail)
      const { data: roleRows, error: roleError } = await supabase
        .from("user_roles")
        .select("roles!inner(app_role)")
        .eq("user_id", user.id);

      if (roleError) {
        console.error("Error checking super admin status:", roleError || rpcError || hasRoleError);
        return false;
      }

      return roleRows?.some((row: any) => {
        const roleData = row.roles;
        if (Array.isArray(roleData)) {
          return roleData.some((r: any) => r?.app_role === "super_admin");
        }
        return roleData?.app_role === "super_admin";
      }) ?? false;
    },
    retry: 1,
    staleTime: 60 * 1000,
    refetchOnWindowFocus: true,
    refetchOnMount: "always",
  });
};

/**
 * Hook to check if user has admin privileges (admin or super_admin)
 */
export const useIsAdmin = () => {
  return useQuery({
    queryKey: ["admin-status"],
    queryFn: async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return false;

      const { data, error } = await supabase.rpc("is_admin", { _user_id: user.id });

      if (error) {
        console.error("Error checking admin status:", error);
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
