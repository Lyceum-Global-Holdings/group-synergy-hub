import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

interface UserRole {
  id: string;
  role: string;
  role_name: string;
  role_description: string;
}

/**
 * Get the display name and priority for a role
 */
const getRoleInfo = (appRole: string) => {
  const roleMap: Record<string, { display: string; priority: number }> = {
    super_admin: { display: "Super Admin", priority: 4 },
    admin: { display: "Admin", priority: 3 },
    moderator: { display: "Moderator", priority: 2 },
    user: { display: "User", priority: 1 },
  };
  return roleMap[appRole] || { display: "User", priority: 0 };
};

/**
 * Get the highest priority role from a list of roles
 */
export const getHighestPriorityRole = (roles: UserRole[]) => {
  if (!roles || roles.length === 0) {
    return { display: "User", appRole: "user", priority: 0 };
  }

  const highest = roles.reduce((highest, current) => {
    const currentInfo = getRoleInfo(current.role);
    const highestInfo = getRoleInfo(highest.role);
    return currentInfo.priority > highestInfo.priority ? current : highest;
  });

  const info = getRoleInfo(highest.role);
  return {
    display: info.display,
    appRole: highest.role,
    priority: info.priority,
  };
};

/**
 * Hook to fetch current user's roles
 */
export const useCurrentUserRoles = () => {
  return useQuery({
    queryKey: ["current-user-roles"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [];

      const { data, error } = await supabase
        .from("user_roles")
        .select(`
          id,
          role,
          roles:role_id (
            name,
            description,
            app_role
          )
        `)
        .eq("user_id", user.id);

      if (error) {
        console.error("Error fetching user roles:", error);
        return [];
      }

      return data.map((ur: any) => ({
        id: ur.id,
        role: ur.roles?.app_role || "user",
        role_name: ur.roles?.name || "User",
        role_description: ur.roles?.description || "",
      }));
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
};
