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
