import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { RoleModule, UserModule, UserModuleAccess } from '@/types/moduleAccess';
import { useToast } from '@/hooks/use-toast';

// Fetch role modules for a specific role
export const useRoleModules = (roleId: string | undefined) => {
  return useQuery({
    queryKey: ['roleModules', roleId],
    queryFn: async () => {
      if (!roleId) return [];
      
      const { data, error } = await supabase
        .from('role_modules')
        .select('*')
        .eq('role_id', roleId);
      
      if (error) throw error;
      return data as RoleModule[];
    },
    enabled: !!roleId,
  });
};

// Fetch user modules for a specific user
export const useUserModules = (userId: string | undefined) => {
  return useQuery({
    queryKey: ['userModules', userId],
    queryFn: async () => {
      if (!userId) return [];
      
      const { data, error } = await supabase
        .from('user_modules')
        .select('*')
        .eq('user_id', userId);
      
      if (error) throw error;
      return data as UserModule[];
    },
    enabled: !!userId,
  });
};

// Calculate effective modules for a user
export const useUserEffectiveModules = (userId: string | undefined) => {
  return useQuery({
    queryKey: ['userEffectiveModules', userId],
    queryFn: async () => {
      if (!userId) {
        return {
          availableModules: [],
          deniedModules: [],
          moduleSubModules: {},
        };
      }
      
      // Get user's roles
      const { data: userRoles, error: rolesError } = await supabase
        .from('user_roles')
        .select('role_id')
        .eq('user_id', userId);
      
      if (rolesError) throw rolesError;
      
      const roleIds = userRoles?.map(ur => ur.role_id) || [];
      
      // Get modules from all user's roles
      const { data: roleModules, error: roleModulesError } = await supabase
        .from('role_modules')
        .select('*')
        .in('role_id', roleIds);
      
      if (roleModulesError) throw roleModulesError;
      
      // Get user-specific module overrides
      const { data: userModules, error: userModulesError } = await supabase
        .from('user_modules')
        .select('*')
        .eq('user_id', userId);
      
      if (userModulesError) throw userModulesError;
      
      // Build module map
      const moduleMap: Record<string, Set<string>> = {};
      const deniedModules: string[] = [];
      
      // Check if user has any user-specific grants
      const hasUserSpecificGrants = userModules?.some(um => um.access_type === 'grant');
      
      if (hasUserSpecificGrants) {
        // User has specific grants - use ONLY those (ignore role modules)
        userModules?.forEach(um => {
          if (um.access_type === 'grant') {
            if (!moduleMap[um.module_key]) {
              moduleMap[um.module_key] = new Set();
            }
            um.submodules.forEach(sub => moduleMap[um.module_key].add(sub));
          } else if (um.access_type === 'deny') {
            deniedModules.push(um.module_key);
          }
        });
      } else {
        // No user-specific grants - use role-based modules
        roleModules?.forEach(rm => {
          if (!moduleMap[rm.module_key]) {
            moduleMap[rm.module_key] = new Set();
          }
          rm.submodules.forEach(sub => moduleMap[rm.module_key].add(sub));
        });
        
        // Apply user denials
        userModules?.forEach(um => {
          if (um.access_type === 'deny') {
            delete moduleMap[um.module_key];
            deniedModules.push(um.module_key);
          }
        });
      }
      
      const result: UserModuleAccess = {
        availableModules: Object.keys(moduleMap),
        deniedModules,
        moduleSubModules: Object.fromEntries(
          Object.entries(moduleMap).map(([key, value]) => [key, Array.from(value)])
        ),
      };
      
      return result;
    },
    enabled: !!userId,
  });
};

// Assign modules to a role
export const useAssignModulesToRole = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  
  return useMutation({
    mutationFn: async ({ 
      roleId, 
      modules 
    }: { 
      roleId: string; 
      modules: Record<string, string[]> 
    }) => {
      // Delete existing modules for this role
      await supabase
        .from('role_modules')
        .delete()
        .eq('role_id', roleId);
      
      // Insert new modules
      const moduleEntries = Object.entries(modules).map(([moduleKey, submodules]) => ({
        role_id: roleId,
        module_key: moduleKey,
        submodules: submodules,
      }));
      
      if (moduleEntries.length > 0) {
        const { error } = await supabase
          .from('role_modules')
          .insert(moduleEntries);
        
        if (error) throw error;
      }
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['roleModules', variables.roleId] });
      queryClient.invalidateQueries({ queryKey: ['userEffectiveModules'] });
      toast({
        title: "Modules updated",
        description: "Role modules have been updated successfully.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });
};

// Assign modules to a user
export const useAssignModulesToUser = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  
  return useMutation({
    mutationFn: async ({ 
      userId, 
      moduleKey,
      submodules,
      accessType 
    }: { 
      userId: string; 
      moduleKey: string;
      submodules: string[];
      accessType: 'grant' | 'deny';
    }) => {
      // Upsert user module
      const { error } = await supabase
        .from('user_modules')
        .upsert({
          user_id: userId,
          module_key: moduleKey,
          submodules: submodules,
          access_type: accessType,
        }, {
          onConflict: 'user_id,module_key'
        });
      
      if (error) throw error;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['userModules', variables.userId] });
      queryClient.invalidateQueries({ queryKey: ['userEffectiveModules', variables.userId] });
      toast({
        title: "Module access updated",
        description: "User module access has been updated successfully.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });
};

// Remove user module override
export const useRemoveUserModule = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  
  return useMutation({
    mutationFn: async ({ 
      userId, 
      moduleKey 
    }: { 
      userId: string; 
      moduleKey: string;
    }) => {
      const { error } = await supabase
        .from('user_modules')
        .delete()
        .eq('user_id', userId)
        .eq('module_key', moduleKey);
      
      if (error) throw error;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['userModules', variables.userId] });
      queryClient.invalidateQueries({ queryKey: ['userEffectiveModules', variables.userId] });
      toast({
        title: "Module removed",
        description: "User module override has been removed.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });
};
