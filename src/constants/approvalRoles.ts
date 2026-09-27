interface ApprovalRoleConfig {
  app_role: 'user' | 'manager' | 'admin';
  permission: string;
  stages: number[];
  max_supplier_value: number | null;
  display_name: string;
}

export const APPROVAL_ROLES = {
  USER: {
    app_role: 'user',
    permission: 'can_review_registrations',
    stages: [1],
    max_supplier_value: 50000,
    display_name: 'Procurement Officer',
  },
  MANAGER: {
    app_role: 'manager',
    permission: 'can_approve_suppliers',
    stages: [2, 3],
    max_supplier_value: 500000,
    display_name: 'Procurement/Finance Manager',
  },
  ADMIN: {
    app_role: 'admin',
    permission: 'can_approve_all',
    stages: [1, 2, 3, 4],
    max_supplier_value: null,
    display_name: 'Administrator',
  },
} satisfies Record<string, ApprovalRoleConfig>;

export type ApprovalRoleKey = keyof typeof APPROVAL_ROLES;

export function getRoleForStage(stageOrder: number): ApprovalRoleKey | null {
  const keys = Object.keys(APPROVAL_ROLES) as ApprovalRoleKey[];
  for (const key of keys) {
    const role = APPROVAL_ROLES[key];
    if (role.stages.includes(stageOrder)) {
      return key;
    }
  }
  return null;
}

export function canUserApproveStage(userRole: string, stageOrder: number): boolean {
  const roleConfig = Object.values(APPROVAL_ROLES).find(r => r.app_role === userRole);
  return roleConfig ? roleConfig.stages.includes(stageOrder) : false;
}
