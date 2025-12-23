import { useCurrentUserRoles } from '@/hooks/useCurrentUserRoles';

export const useIsAdminOrHigher = () => {
  const { data: userRoles = [], isLoading } = useCurrentUserRoles();
  
  const canDelete = userRoles.some(role => 
    role.role === 'admin' || 
    role.role === 'super_admin' || 
    role.role === 'moderator'
  );
  
  return { canDelete, isLoading };
};
