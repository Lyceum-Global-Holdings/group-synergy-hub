import { useCallback, useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useUserEffectiveModules } from '@/hooks/useModuleAccess';
import { useSuperAdmin, useIsAdmin } from '@/hooks/useSuperAdmin';
import type { ModuleOperation } from '@/types/moduleAccess';

export const useRBAC = () => {
  const { user } = useAuth();
  const { data: effectiveModules, isLoading: modulesLoading } = useUserEffectiveModules(user?.id);
  const { data: isSuperAdmin = false, isLoading: superAdminLoading } = useSuperAdmin();
  const { data: isAdmin = false, isLoading: adminLoading } = useIsAdmin();

  const isLoading = modulesLoading || superAdminLoading || adminLoading;

  const canPerform = useCallback((
    moduleKey: string,
    operation: ModuleOperation
  ): boolean => {
    // Admins can do everything
    if (isSuperAdmin || isAdmin) return true;

    // Check module access
    if (!effectiveModules?.availableModules.includes(moduleKey)) {
      return false;
    }

    // Check operation permission
    const ops = effectiveModules?.moduleOperations[moduleKey] || ['view'];
    return ops.includes(operation);
  }, [effectiveModules, isSuperAdmin, isAdmin]);

  const hasModule = useCallback((moduleKey: string): boolean => {
    if (isSuperAdmin || isAdmin) return true;
    return effectiveModules?.availableModules.includes(moduleKey) ?? false;
  }, [effectiveModules, isSuperAdmin, isAdmin]);

  const hasSubModule = useCallback((moduleKey: string, subModuleKey: string): boolean => {
    if (isSuperAdmin || isAdmin) return true;
    return effectiveModules?.moduleSubModules[moduleKey]?.includes(subModuleKey) ?? false;
  }, [effectiveModules, isSuperAdmin, isAdmin]);

  const getModuleOperations = useCallback((moduleKey: string): ModuleOperation[] => {
    if (isSuperAdmin || isAdmin) {
      return ['view', 'add', 'edit', 'delete', 'download'];
    }
    return effectiveModules?.moduleOperations[moduleKey] || ['view'];
  }, [effectiveModules, isSuperAdmin, isAdmin]);

  return useMemo(() => ({
    // Loading state
    isLoading,

    // Role checks
    isSuperAdmin,
    isAdmin,
    isAdminOrHigher: isSuperAdmin || isAdmin,

    // Module checks
    hasModule,
    hasSubModule,
    getModuleOperations,

    // Operation checks
    canView: (module: string) => canPerform(module, 'view'),
    canAdd: (module: string) => canPerform(module, 'add'),
    canEdit: (module: string) => canPerform(module, 'edit'),
    canDelete: (module: string) => canPerform(module, 'delete'),
    canDownload: (module: string) => canPerform(module, 'download'),
    canPerform,

    // Raw data
    effectiveModules,
  }), [
    isLoading,
    isSuperAdmin,
    isAdmin,
    hasModule,
    hasSubModule,
    getModuleOperations,
    canPerform,
    effectiveModules,
  ]);
};
