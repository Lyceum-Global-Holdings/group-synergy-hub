export const APPROVAL_ROLES = {
  USER: {
    app_role: 'user',
    permission: 'can_review_registrations',
    stages: [1] as number[],
    max_supplier_value: 50000,
    display_name: 'Procurement Officer',
  },
  MODERATOR: {
    app_role: 'moderator',
    permission: 'can_approve_suppliers',
    stages: [2, 3] as number[],
    max_supplier_value: 500000,
    display_name: 'Procurement/Finance Manager',
  },
  ADMIN: {
    app_role: 'admin',
    permission: 'can_approve_all',
    stages: [1, 2, 3, 4] as number[],
    max_supplier_value: null,
    display_name: 'Administrator',
  },
} as const;

export type ApprovalRoleKey = keyof typeof APPROVAL_ROLES;

export function getRoleForStage(stageOrder: number): ApprovalRoleKey | null {
  for (const [key, role] of Object.entries(APPROVAL_ROLES)) {
    if (role.stages.includes(stageOrder)) {
      return key as ApprovalRoleKey;
    }
  }
  return null;
}

export function canUserApproveStage(userRole: string, stageOrder: number): boolean {
  const roleConfig = Object.values(APPROVAL_ROLES).find(r => r.app_role === userRole);
  return roleConfig ? roleConfig.stages.includes(stageOrder) : false;
}
