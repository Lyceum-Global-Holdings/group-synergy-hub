import { useCallback, useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useUserEffectiveModules } from '@/hooks/useModuleAccess';
import { useSuperAdmin, useIsAdmin } from '@/hooks/useSuperAdmin';
import type { ModuleOperation } from '@/types/moduleAccess';
import { SAP_MODULE_KEY, DEPARTMENT_MODULE_MAPPING, type SAPOperation } from '@/constants/rbacConfig';

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

  // ============================================
  // SAP INTEGRATION HELPERS
  // ============================================

  const hasSAPAccess = useCallback((): boolean => {
    if (isSuperAdmin || isAdmin) return true;
    return hasModule(SAP_MODULE_KEY) || hasModule('finance');
  }, [isSuperAdmin, isAdmin, hasModule]);

  const canPerformSAPOperation = useCallback((operation: SAPOperation): boolean => {
    if (isSuperAdmin || isAdmin) return true;
    
    // Check SAP module access
    if (!hasSAPAccess()) return false;
    
    // Configure and audit require admin or specific SAP permissions
    if (operation === 'configure') {
      return isAdmin || isSuperAdmin;
    }
    
    // Sync requires finance or SAP module access
    if (operation === 'sync') {
      return hasModule('finance') || hasModule(SAP_MODULE_KEY);
    }
    
    // View and audit available to anyone with SAP access
    return true;
  }, [isSuperAdmin, isAdmin, hasSAPAccess, hasModule]);

  // ============================================
  // DEPARTMENT-BASED ACCESS HELPERS
  // ============================================

  const hasDepartmentAccess = useCallback((department: keyof typeof DEPARTMENT_MODULE_MAPPING): boolean => {
    if (isSuperAdmin || isAdmin) return true;
    const modules = DEPARTMENT_MODULE_MAPPING[department];
    return modules.some(moduleKey => hasModule(moduleKey));
  }, [isSuperAdmin, isAdmin, hasModule]);

  const hasFinanceAccess = useCallback((): boolean => {
    return isSuperAdmin || isAdmin || hasModule('finance');
  }, [isSuperAdmin, isAdmin, hasModule]);

  const hasProcurementAccess = useCallback((): boolean => {
    return isSuperAdmin || isAdmin || hasModule('procurement') || hasModule('sourcing');
  }, [isSuperAdmin, isAdmin, hasModule]);

  const hasWarehouseAccess = useCallback((): boolean => {
    return isSuperAdmin || isAdmin || hasModule('warehouse');
  }, [isSuperAdmin, isAdmin, hasModule]);

  const hasHRAccess = useCallback((): boolean => {
    return isSuperAdmin || isAdmin || hasModule('training') || hasModule('hr');
  }, [isSuperAdmin, isAdmin, hasModule]);

  const hasConstructionAccess = useCallback((): boolean => {
    return isSuperAdmin || isAdmin || hasModule('construction');
  }, [isSuperAdmin, isAdmin, hasModule]);

  const hasSalesAccess = useCallback((): boolean => {
    return isSuperAdmin || isAdmin || hasModule('tuh-modules') || hasModule('sales');
  }, [isSuperAdmin, isAdmin, hasModule]);

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

    // SAP Integration helpers
    hasSAPAccess,
    canPerformSAPOperation,
    canSyncSAP: () => canPerformSAPOperation('sync'),
    canConfigureSAP: () => canPerformSAPOperation('configure'),
    canAuditSAP: () => canPerformSAPOperation('audit'),

    // Department-based access helpers
    hasDepartmentAccess,
    hasFinanceAccess,
    hasProcurementAccess,
    hasWarehouseAccess,
    hasHRAccess,
    hasConstructionAccess,
    hasSalesAccess,

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
    hasSAPAccess,
    canPerformSAPOperation,
    hasDepartmentAccess,
    hasFinanceAccess,
    hasProcurementAccess,
    hasWarehouseAccess,
    hasHRAccess,
    hasConstructionAccess,
    hasSalesAccess,
    effectiveModules,
  ]);
};
