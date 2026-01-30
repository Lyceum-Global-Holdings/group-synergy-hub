
# Plan: Make Asset Master Visible to All Admins

## Problem Analysis

The current RLS policy on `asset_master` table allows admins to view records, but only for assets that belong to the same company as the admin user. This is because:

1. The SELECT policy requires `can_access_company(company_id) AND is_admin(auth.uid())`
2. The `can_access_company()` function only bypasses company checks for **super_admin** users
3. Regular **admin** users must match the company_id of the asset

### Current Policy Logic
```text
is_super_admin(auth.uid())  →  Can see ALL assets (any company)
          OR
can_access_company(company_id) AND is_admin(auth.uid())  →  Can see assets from their own company only
```

### Desired Behavior
All users with `admin` or `super_admin` roles should be able to view ALL asset_master items regardless of company.

---

## Solution

Update the RLS policy on `asset_master` to allow users with admin privileges (`is_admin()` returns true) to bypass the company restriction, similar to how super_admin works.

### Changes Required

**File: New Migration**

Create a new migration to update the SELECT policy:

```sql
-- Drop conflicting/duplicate policies
DROP POLICY IF EXISTS "Finance and asset managers can view assets" ON asset_master;
DROP POLICY IF EXISTS "Finance and management can view asset master" ON asset_master;

-- Create a single, unified SELECT policy
CREATE POLICY "Company users and admins can view asset master"
ON asset_master FOR SELECT
USING (
  -- Super admins and admins can see ALL assets (any company)
  is_admin(auth.uid()) 
  OR
  -- Other roles require company match plus specific role access
  (can_access_company(company_id) AND 
   (has_finance_access(auth.uid()) OR 
    has_warehouse_access(auth.uid()) OR
    has_manager_access(auth.uid())))
);
```

---

## Technical Details

### Policy Logic After Fix
```text
is_admin(auth.uid())  →  Can see ALL assets (admin or super_admin role)
          OR
can_access_company(company_id) AND (finance OR warehouse OR manager access)  →  Same company only
```

### Why This Works

The `is_admin()` function already returns `TRUE` for both `admin` and `super_admin` roles:

```sql
SELECT EXISTS (
  SELECT 1
  FROM public.user_roles ur
  JOIN public.roles r ON ur.role_id = r.id
  WHERE ur.user_id = _user_id
    AND r.app_role IN ('admin','super_admin')  -- Both admin types
);
```

By moving `is_admin()` outside the `can_access_company()` check, all admin-level users get universal access to asset_master.

---

## Files to Create/Modify

| File | Action | Description |
|------|--------|-------------|
| `supabase/migrations/[timestamp]_admin_asset_master_access.sql` | Create | Migration to update RLS policy |

---

## Impact Assessment

- **Admins**: Will now see asset_master items from ALL companies
- **Super Admins**: No change (already had universal access)
- **Finance/Warehouse/Manager roles**: No change (still limited to their company)
- **Regular users**: No change (no access)

---

## Rollback Plan

If needed, the previous policy can be restored by recreating the original conditions that include `is_admin()` inside the company access check.
