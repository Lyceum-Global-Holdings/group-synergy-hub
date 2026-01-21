import { useCurrentUserRoles } from '@/hooks/useCurrentUserRoles';
import { useSuperAdmin, useIsAdmin } from '@/hooks/useSuperAdmin';

export const useIsAdminOrHigher = () => {
  const { data: userRoles = [], isLoading: rolesLoading } = useCurrentUserRoles();
  const { data: isSuperAdmin, isLoading: superAdminLoading } = useSuperAdmin();
  const { data: isAdmin, isLoading: adminLoading } = useIsAdmin();
  
  const isLoading = rolesLoading || superAdminLoading || adminLoading;
  
  // Check roles from user_roles table
  const hasRoleFromTable = userRoles.some(role => 
    role.role === 'admin' || 
    role.role === 'super_admin' || 
    role.role === 'moderator'
  );
  
  // Also check via RPC functions (these use SECURITY DEFINER and bypass RLS)
  const canDelete = hasRoleFromTable || isSuperAdmin === true || isAdmin === true;
  
  return { canDelete, isLoading };
};
