import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { getCachedUser } from "@/lib/currentUser";
import { toast } from 'sonner';

export const useDeleteUser = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (userId: string) => {
      // Verify super admin status first
      const user = getCachedUser();
      if (!user) throw new Error('Not authenticated');
      
      const { data: isSuperAdmin, error: checkError } = await supabase
        .rpc('is_super_admin', { _user_id: user.id });
      
      if (checkError) throw checkError;
      if (!isSuperAdmin) {
        throw new Error('Only super administrators can delete users');
      }

      // First delete user roles
      const { error: rolesError } = await supabase
        .from('user_roles')
        .delete()
        .eq('user_id', userId);

      if (rolesError) throw rolesError;

      // Then delete profile
      const { error: profileError } = await supabase
        .from('profiles')
        .delete()
        .eq('user_id', userId);

      if (profileError) throw profileError;

      // Finally delete from auth (this requires admin privileges)
      const { error: authError } = await supabase.auth.admin.deleteUser(userId);
      if (authError) {
        console.error('Auth deletion error:', authError);
        // Don't throw here as profile is already deleted
      }

      return { userId };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      queryClient.invalidateQueries({ queryKey: ['roles'] });
      toast.success('User deleted successfully');
    },
    onError: (error: any) => {
      console.error('User deletion failed:', error);
      toast.error(`Failed to delete user: ${error.message}`);
    },
  });
};

export const useUpdateRole = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      roleId,
      roleData,
    }: {
      roleId: string;
      roleData: {
        name: string;
        description: string;
        department: string;
        app_role: string;
        permissions: string[];
      };
    }) => {
      // Update role
      const { error: roleError } = await supabase
        .from('roles')
        .update({
          name: roleData.name,
          description: roleData.description,
          department: roleData.department,
          app_role: roleData.app_role as any,
        })
        .eq('id', roleId);

      if (roleError) throw roleError;

      // Delete existing permissions
      const { error: deletePermError } = await supabase
        .from('role_permissions')
        .delete()
        .eq('role_id', roleId);

      if (deletePermError) throw deletePermError;

      // Add new permissions
      if (roleData.permissions.length > 0) {
        const { error: permError } = await supabase
          .from('role_permissions')
          .insert(
            roleData.permissions.map(permissionId => ({
              role_id: roleId,
              permission_id: permissionId,
            }))
          );

        if (permError) throw permError;
      }

      return { roleId };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['roles'] });
      queryClient.invalidateQueries({ queryKey: ['users'] });
      toast.success('Role updated successfully');
    },
    onError: (error: any) => {
      console.error('Role update failed:', error);
      toast.error(`Failed to update role: ${error.message}`);
    },
  });
};

export const useDeleteRole = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (roleId: string) => {
      // First check if role has any users assigned
      const { count } = await supabase
        .from('user_roles')
        .select('*', { count: 'exact', head: true })
        .eq('role_id', roleId);

      if (count && count > 0) {
        throw new Error(`Cannot delete role. ${count} users are currently assigned to this role. Please remove all users first.`);
      }

      // Delete role permissions
      const { error: permError } = await supabase
        .from('role_permissions')
        .delete()
        .eq('role_id', roleId);

      if (permError) throw permError;

      // Delete role
      const { error: roleError } = await supabase
        .from('roles')
        .delete()
        .eq('id', roleId);

      if (roleError) throw roleError;

      return { roleId };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['roles'] });
      queryClient.invalidateQueries({ queryKey: ['users'] });
      toast.success('Role deleted successfully');
    },
    onError: (error: any) => {
      console.error('Role deletion failed:', error);
      toast.error(`Failed to delete role: ${error.message}`);
    },
  });
};