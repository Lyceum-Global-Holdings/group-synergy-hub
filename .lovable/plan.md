
# Plan: Add CRUD + Download Controls to RBAC System

## Current State Analysis

Your RBAC system currently has:

| Component | Purpose | Limitation |
|-----------|---------|------------|
| `permissions` table | Generic CRUD permissions (user.view, user.create, etc.) | Only 16 high-level system permissions |
| `role_permissions` | Links roles to permissions | Not connected to modules/submodules |
| `role_modules` | Module access per role (submodules array) | Only tracks access, not operations |
| `user_modules` | User-specific overrides (grant/deny) | Only tracks access, not operations |

**Current Gap**: The system knows *which* modules a user can access, but not *what operations* they can perform within those modules.

---

## Proposed Solution

Extend the RBAC system to support **operation-level controls** per module/submodule:

```text
Operations: view | add | edit | delete | download
```

### Option A: Extend Existing Tables (Recommended)

Add an `operations` column to track allowed actions per module:

```sql
-- Add operations column to role_modules
ALTER TABLE role_modules ADD COLUMN operations text[] DEFAULT ARRAY['view'];

-- Add operations column to user_modules  
ALTER TABLE user_modules ADD COLUMN operations text[] DEFAULT ARRAY['view'];
```

**Schema After Change:**

| Table | Columns |
|-------|---------|
| `role_modules` | id, role_id, module_key, submodules, **operations**, created_at |
| `user_modules` | id, user_id, module_key, submodules, **operations**, access_type, created_at |

---

## Implementation Details

### 1. Database Migration

Create a new migration to add operations support:

```sql
-- Add operations array column with default view permission
ALTER TABLE role_modules 
ADD COLUMN IF NOT EXISTS operations text[] DEFAULT ARRAY['view'];

ALTER TABLE user_modules 
ADD COLUMN IF NOT EXISTS operations text[] DEFAULT ARRAY['view'];

-- Create helper function to check operation access
CREATE OR REPLACE FUNCTION has_operation_access(
  _user_id uuid, 
  _module_key text, 
  _operation text
)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    -- Admins always have all operations
    is_admin(_user_id)
    OR
    -- Check user-specific grants first
    EXISTS (
      SELECT 1 FROM user_modules um
      WHERE um.user_id = _user_id 
      AND um.module_key = _module_key 
      AND um.access_type = 'grant'
      AND _operation = ANY(um.operations)
    )
    OR
    -- Check role-based operations (if no user-specific grants exist)
    (
      NOT EXISTS (
        SELECT 1 FROM user_modules um
        WHERE um.user_id = _user_id 
        AND um.access_type = 'grant'
      )
      AND EXISTS (
        SELECT 1 FROM user_roles ur
        JOIN role_modules rm ON ur.role_id = rm.role_id
        WHERE ur.user_id = _user_id 
        AND rm.module_key = _module_key
        AND _operation = ANY(rm.operations)
      )
      AND NOT EXISTS (
        SELECT 1 FROM user_modules um
        WHERE um.user_id = _user_id 
        AND um.module_key = _module_key 
        AND um.access_type = 'deny'
      )
    );
$$;
```

### 2. TypeScript Types

Update types to include operations:

```typescript
// src/types/moduleAccess.ts
export type ModuleOperation = 'view' | 'add' | 'edit' | 'delete' | 'download';

export interface RoleModule {
  id: string;
  role_id: string;
  module_key: string;
  submodules: string[];
  operations: ModuleOperation[];  // NEW
  created_at: string;
  updated_at: string;
}

export interface UserModule {
  id: string;
  user_id: string;
  module_key: string;
  submodules: string[];
  operations: ModuleOperation[];  // NEW
  access_type: 'grant' | 'deny';
  created_at: string;
  updated_at: string;
}

export interface UserModuleAccess {
  availableModules: string[];
  deniedModules: string[];
  moduleSubModules: Record<string, string[]>;
  moduleOperations: Record<string, ModuleOperation[]>;  // NEW
}
```

### 3. RBAC Constants

Create centralized RBAC configuration:

```typescript
// src/constants/rbacConfig.ts
export const OPERATIONS = ['view', 'add', 'edit', 'delete', 'download'] as const;

export type Operation = typeof OPERATIONS[number];

export const OPERATION_LABELS: Record<Operation, string> = {
  view: 'View',
  add: 'Add/Create',
  edit: 'Edit/Update',
  delete: 'Delete',
  download: 'Download/Export',
};

export const APP_ROLE_HIERARCHY = {
  super_admin: 4,
  admin: 3,
  manager: 2,
  user: 1,
} as const;

// Default operations by role level
export const DEFAULT_OPERATIONS_BY_ROLE: Record<string, Operation[]> = {
  super_admin: ['view', 'add', 'edit', 'delete', 'download'],
  admin: ['view', 'add', 'edit', 'delete', 'download'],
  manager: ['view', 'add', 'edit', 'download'],
  user: ['view', 'download'],
};
```

### 4. Enhanced useRBAC Hook

Create a centralized hook for all RBAC checks:

```typescript
// src/hooks/useRBAC.ts
export const useRBAC = () => {
  const { user } = useAuth();
  const { data: effectiveModules } = useUserEffectiveModules(user?.id);
  const { data: isSuperAdmin } = useSuperAdmin();
  const { data: isAdmin } = useIsAdmin();

  const canPerform = useCallback((
    moduleKey: string, 
    operation: Operation
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

  return {
    // Role checks
    isSuperAdmin,
    isAdmin,
    
    // Module checks
    hasModule: (key: string) => effectiveModules?.availableModules.includes(key),
    
    // Operation checks
    canView: (module: string) => canPerform(module, 'view'),
    canAdd: (module: string) => canPerform(module, 'add'),
    canEdit: (module: string) => canPerform(module, 'edit'),
    canDelete: (module: string) => canPerform(module, 'delete'),
    canDownload: (module: string) => canPerform(module, 'download'),
    canPerform,
  };
};
```

### 5. Updated ModuleAccessEditor UI

Enhance the editor to show operation checkboxes:

```text
+--------------------------------------------------+
| Finance Module                                    |
|   [x] General Ledger                             |
|       Operations: [x]View [x]Add [x]Edit [ ]Delete [x]Download |
|   [x] Accounts Payable                           |
|       Operations: [x]View [x]Add [ ]Edit [ ]Delete [x]Download |
+--------------------------------------------------+
```

---

## Files to Create/Modify

| File | Action | Description |
|------|--------|-------------|
| `supabase/migrations/[timestamp]_add_operations_to_modules.sql` | Create | Add operations column + helper function |
| `src/types/moduleAccess.ts` | Modify | Add ModuleOperation type and update interfaces |
| `src/constants/rbacConfig.ts` | Create | RBAC constants, role hierarchy, default operations |
| `src/hooks/useRBAC.ts` | Create | Centralized RBAC hook with operation checks |
| `src/hooks/useModuleAccess.ts` | Modify | Include operations in effective modules calculation |
| `src/components/admin/ModuleAccessEditor.tsx` | Modify | Add operation checkboxes per submodule |
| `src/components/admin/OperationCheckboxes.tsx` | Create | Reusable operation checkbox group component |
| `src/components/admin/EditRoleDialog.tsx` | Modify | Use updated ModuleAccessEditor |
| `src/components/admin/EditUserDialog.tsx` | Modify | Use updated ModuleAccessEditor |

---

## Usage Example

After implementation, components can check permissions like this:

```typescript
// In any component
const { canAdd, canEdit, canDelete, canDownload } = useRBAC();

return (
  <div>
    {canAdd('warehouse') && <Button>Add Item</Button>}
    {canEdit('warehouse') && <Button>Edit Item</Button>}
    {canDelete('warehouse') && <Button>Delete Item</Button>}
    {canDownload('warehouse') && <Button>Download QR</Button>}
  </div>
);
```

---

## Migration Strategy

1. **Phase 1**: Add columns with defaults (existing data gets `['view']`)
2. **Phase 2**: Update admin UI to manage operations
3. **Phase 3**: Update database function for operation checks
4. **Phase 4**: Create `useRBAC` hook
5. **Phase 5**: Gradually replace `useIsAdminOrHigher` with `useRBAC` in components

---

## Security Considerations

- All operation checks enforce `is_admin()` bypass for admin users
- Database function uses `SECURITY DEFINER` with `SET search_path = public`
- Client-side checks are for UI only; server-side RLS policies remain unchanged
- Existing RLS policies continue to work independently

---

## Backward Compatibility

- Default operations array `['view']` ensures existing access works
- Existing `useIsAdminOrHigher` continues to work
- Gradual migration path - no breaking changes
