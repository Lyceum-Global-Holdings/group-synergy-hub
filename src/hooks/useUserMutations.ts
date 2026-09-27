import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export type DeleteUserOutcome = 'deleted' | 'deactivated';

/**
 * Removes a user's access for good (super admins only), via the
 * admin-delete-user edge function: the login is blocked and all access removed.
 * Users who appear on no records are deleted outright; everyone else is
 * deactivated so their name stays on the records they created or approved.
 */
export const useDeleteUser = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (userId: string): Promise<{ userId: string; outcome: DeleteUserOutcome }> => {
      const { data, error } = await supabase.functions.invoke<{
        success: boolean;
        outcome?: DeleteUserOutcome;
        error?: string;
      }>('admin-delete-user', { body: { userId } });

      if (error || !data) {
        let message = 'Could not delete the user. Try again.';
        try {
          const body = await (error as { context?: Response } | null)?.context?.json();
          if (body?.error) message = body.error;
        } catch {
          // keep the generic message
        }
        throw new Error(message);
      }
      if (!data.success || !data.outcome) throw new Error(data.error ?? 'Could not delete the user.');
      return { userId, outcome: data.outcome };
    },
    onSuccess: ({ outcome }) => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      queryClient.invalidateQueries({ queryKey: ['roles'] });
      if (outcome === 'deleted') {
        toast.success('User deleted');
      } else {
        toast.success('User deactivated', {
          description: "Their login no longer works. They're kept because their name appears on records they created or approved.",
        });
      }
    },
    onError: (error: Error) => {
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