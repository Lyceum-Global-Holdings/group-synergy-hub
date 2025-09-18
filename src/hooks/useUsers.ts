import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

// Hook to bootstrap admin user (for first-time setup)
export const useBootstrapAdmin = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (userId: string) => {
      const { error } = await supabase.rpc('bootstrap_admin', {
        _user_id: userId
      });
      
      if (error) {
        throw error;
      }
      
      return { success: true };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      queryClient.invalidateQueries({ queryKey: ['roles'] });
      toast.success('Admin privileges granted successfully');
    },
    onError: (error: any) => {
      console.error('Bootstrap admin failed:', error);
      toast.error(`Failed to grant admin privileges: ${error.message}`);
    },
  });
};

export interface User {
  id: string;
  email: string;
  full_name: string | null;
  avatar_url: string | null;
  department: string | null;
  created_at: string;
  updated_at: string;
  roles: Array<{
    id: string;
    name: string;
    department: string | null;
    app_role: string;
  }>;
  last_sign_in_at: string | null;
}

export interface Role {
  id: string;
  name: string;
  description: string | null;
  department: string | null;
  app_role: string;
  created_at: string;
  updated_at: string;
  permissions: Array<{
    id: string;
    name: string;
    description: string | null;
    category: string;
  }>;
  user_count: number;
}

export const useUsers = () => {
  return useQuery({
    queryKey: ['users'],
    queryFn: async (): Promise<User[]> => {
      // Get profiles with user roles
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('*');

      if (profilesError) throw profilesError;

      // Get user roles with role details
      const { data: userRoles, error: userRolesError } = await supabase
        .from('user_roles')
        .select(`
          user_id,
          roles (
            id,
            name,
            department,
            app_role
          )
        `);

      if (userRolesError) throw userRolesError;

      const users = profiles?.map(profile => {
        // Find roles for this user
        const userRoleData = userRoles?.filter(ur => ur.user_id === profile.user_id) || [];
        const roles = userRoleData.map(ur => (ur as any).roles).filter(Boolean);

        return {
          id: profile.user_id,
          email: profile.email || '',
          full_name: profile.full_name,
          avatar_url: profile.avatar_url,
          department: profile.department,
          created_at: profile.created_at,
          updated_at: profile.updated_at,
          roles: roles,
          last_sign_in_at: null, // We'll skip auth.admin for now as it requires service role
        };
      }) || [];

      return users;
    },
  });
};

export const useRoles = () => {
  return useQuery({
    queryKey: ['roles'],
    queryFn: async (): Promise<Role[]> => {
      // Get roles
      const { data: roles, error: rolesError } = await supabase
        .from('roles')
        .select('*');

      if (rolesError) throw rolesError;

      // Get role permissions with permission details
      const { data: rolePermissions, error: rolePermError } = await supabase
        .from('role_permissions')
        .select(`
          role_id,
          permissions (
            id,
            name,
            description,
            category
          )
        `);

      if (rolePermError) throw rolePermError;

      // Get user counts for each role
      const rolesWithCounts = await Promise.all(
        roles?.map(async (role) => {
          const { count } = await supabase
            .from('user_roles')
            .select('*', { count: 'exact', head: true })
            .eq('role_id', role.id);

          // Find permissions for this role
          const rolePermissionData = rolePermissions?.filter(rp => rp.role_id === role.id) || [];
          const permissions = rolePermissionData.map(rp => (rp as any).permissions).filter(Boolean);

          return {
            ...role,
            permissions: permissions,
            user_count: count || 0,
          };
        }) || []
      );

      return rolesWithCounts;
    },
  });
};

export const usePermissions = () => {
  return useQuery({
    queryKey: ['permissions'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('permissions')
        .select('*')
        .order('category', { ascending: true })
        .order('name', { ascending: true });

      if (error) throw error;
      return data;
    },
  });
};

export const useAssignRole = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ userId, roleId }: { userId: string; roleId: string }) => {
      const { error } = await supabase
        .from('user_roles')
        .insert({ user_id: userId, role_id: roleId });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      queryClient.invalidateQueries({ queryKey: ['roles'] });
    },
  });
};

export const useRemoveRole = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ userId, roleId }: { userId: string; roleId: string }) => {
      const { error } = await supabase
        .from('user_roles')
        .delete()
        .match({ user_id: userId, role_id: roleId });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      queryClient.invalidateQueries({ queryKey: ['roles'] });
    },
  });
};

export const useCreateRole = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (roleData: {
      name: string;
      description: string;
      department: string;
      app_role: string;
      permissions: string[];
    }) => {
      // Create role
      const { data: role, error: roleError } = await supabase
        .from('roles')
        .insert({
          name: roleData.name,
          description: roleData.description,
          department: roleData.department,
          app_role: roleData.app_role as any,
        })
        .select()
        .single();

      if (roleError) throw roleError;

      // Assign permissions
      if (roleData.permissions.length > 0) {
        const { error: permError } = await supabase
          .from('role_permissions')
          .insert(
            roleData.permissions.map(permissionId => ({
              role_id: role.id,
              permission_id: permissionId,
            }))
          );

        if (permError) throw permError;
      }

      return role;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['roles'] });
    },
  });
};

export const useUpdateProfile = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      userId,
      updates,
    }: {
      userId: string;
      updates: {
        full_name?: string;
        department?: string;
        avatar_url?: string;
      };
    }) => {
      const { error } = await supabase
        .from('profiles')
        .update(updates)
        .eq('user_id', userId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
    },
  });
};

export const useCreateUser = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (userData: {
      email: string;
      password: string;
      fullName: string;
      department?: string;
      roleIds: string[];
    }) => {
      console.log('Creating user with data:', userData);
      
      // First check if current user is admin or if no admins exist
      const { data: currentUser } = await supabase.auth.getUser();
      if (!currentUser.user) {
        throw new Error('You must be logged in to create users');
      }

      // Check admin status or if this is bootstrap scenario
      const { data: isAdminResult, error: adminCheckError } = await supabase
        .rpc('is_admin', { _user_id: currentUser.user.id });
      
      if (adminCheckError) {
        console.error('Admin check error:', adminCheckError);
      }

      // Check if any admin users exist
      const { data: adminUsers, error: adminCountError } = await supabase
        .from('user_roles')
        .select('id, roles!inner(*)')
        .eq('roles.app_role', 'admin');

      if (adminCountError) {
        console.error('Admin count check error:', adminCountError);
      }

      const hasAdmins = adminUsers && adminUsers.length > 0;
      const isCurrentUserAdmin = isAdminResult === true;

      if (hasAdmins && !isCurrentUserAdmin) {
        throw new Error('Only administrators can create new users');
      }
      
      // Create user via Supabase Auth
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: userData.email,
        password: userData.password,
        options: {
          data: {
            full_name: userData.fullName
          }
        }
      });

      if (authError) {
        console.error('Auth error:', authError);
        throw new Error(`Failed to create user account: ${authError.message}`);
      }

      if (!authData.user) {
        throw new Error('User creation failed - no user returned');
      }

      console.log('User created successfully:', authData.user.id);

      // Update profile with department if provided
      if (userData.department) {
        const { error: profileError } = await supabase
          .from('profiles')
          .update({ department: userData.department })
          .eq('user_id', authData.user.id);

        if (profileError) {
          console.error('Profile update error:', profileError);
          // Don't throw here, just log - the user was created successfully
        }
      }

      // Assign roles if any provided
      if (userData.roleIds && userData.roleIds.length > 0) {
        const userRoleInserts = userData.roleIds.map(roleId => ({
          user_id: authData.user.id,
          role_id: roleId
        }));

        const { error: roleError } = await supabase
          .from('user_roles')
          .insert(userRoleInserts);

        if (roleError) {
          console.error('Role assignment error:', roleError);
          throw new Error(`User created but role assignment failed: ${roleError.message}`);
        }
      }

      return authData.user;
    },
    onSuccess: () => {
      // Invalidate and refetch users
      queryClient.invalidateQueries({ queryKey: ['users'] });
      queryClient.invalidateQueries({ queryKey: ['roles'] });
      toast.success('User created successfully');
    },
    onError: (error: any) => {
      console.error('User creation failed:', error);
      if (error.message.includes('Only administrators')) {
        toast.error('Access denied: Administrator privileges required to create users');
      } else if (error.message.includes('logged in')) {
        toast.error('Please log in to create users');
      } else if (error.message.includes('role assignment failed')) {
        toast.error(`User created but ${error.message}`);
      } else {
        toast.error(`Failed to create user: ${error.message}`);
      }
    },
  });
};