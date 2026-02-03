import type { ModuleOperation } from '@/types/moduleAccess';

export const OPERATIONS = ['view', 'add', 'edit', 'delete', 'download'] as const;

export type Operation = typeof OPERATIONS[number];

export const OPERATION_LABELS: Record<Operation, string> = {
  view: 'View',
  add: 'Add',
  edit: 'Edit',
  delete: 'Delete',
  download: 'Download',
};

export const OPERATION_ICONS: Record<Operation, string> = {
  view: 'Eye',
  add: 'Plus',
  edit: 'Pencil',
  delete: 'Trash2',
  download: 'Download',
};

export const APP_ROLE_HIERARCHY = {
  super_admin: 4,
  admin: 3,
  manager: 2,
  user: 1,
} as const;

export type AppRole = keyof typeof APP_ROLE_HIERARCHY;

// Default operations by role level
export const DEFAULT_OPERATIONS_BY_ROLE: Record<AppRole, ModuleOperation[]> = {
  super_admin: ['view', 'add', 'edit', 'delete', 'download'],
  admin: ['view', 'add', 'edit', 'delete', 'download'],
  manager: ['view', 'add', 'edit', 'download'],
  user: ['view', 'download'],
};

// Get default operations for a given app_role
export const getDefaultOperations = (appRole: string): ModuleOperation[] => {
  return DEFAULT_OPERATIONS_BY_ROLE[appRole as AppRole] || DEFAULT_OPERATIONS_BY_ROLE.user;
};

// ============================================
// SAP INTEGRATION CONSTANTS
// ============================================

export const SAP_MODULE_KEY = 'sap-integration';

export const SAP_OPERATIONS = ['view', 'sync', 'configure', 'audit'] as const;

export type SAPOperation = typeof SAP_OPERATIONS[number];

export const SAP_OPERATION_LABELS: Record<SAPOperation, string> = {
  view: 'View SAP Data',
  sync: 'Sync with SAP',
  configure: 'Configure SAP Settings',
  audit: 'View Sync Logs',
};

// SAP Sync Status Values
export const SAP_SYNC_STATUS = {
  PENDING: 'pending',
  SYNCING: 'syncing',
  SYNCED: 'synced',
  ERROR: 'error',
  SKIPPED: 'skipped',
} as const;

export type SAPSyncStatus = typeof SAP_SYNC_STATUS[keyof typeof SAP_SYNC_STATUS];

// SAP Entity Types for mapping
export const SAP_ENTITY_TYPES = {
  PURCHASE_ORDER: 'purchase_order',
  SUPPLIER_INVOICE: 'supplier_invoice',
  CUSTOMER_INVOICE: 'customer_invoice',
  SUPPLIER: 'supplier',
  CUSTOMER: 'customer',
  MATERIAL: 'material',
  GL_ACCOUNT: 'gl_account',
} as const;

export type SAPEntityType = typeof SAP_ENTITY_TYPES[keyof typeof SAP_ENTITY_TYPES];

// Department to Module Mapping for RBAC
export const DEPARTMENT_MODULE_MAPPING = {
  Finance: ['finance', 'sap-integration'],
  Procurement: ['procurement', 'sourcing'],
  Warehouse: ['warehouse'],
  Construction: ['construction'],
  HR: ['training', 'hr'],
  IT: ['administration', 'sap-integration'],
  Sales: ['tuh-modules', 'sales'],
  Management: ['management'],
} as const;

export type Department = keyof typeof DEPARTMENT_MODULE_MAPPING;
