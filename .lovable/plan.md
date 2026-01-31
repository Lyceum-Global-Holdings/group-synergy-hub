
# Plan: Allow All Authenticated Users to Download QR Codes

## Problem

Currently, the `asset_master` table has a restrictive SELECT policy that only allows:
- Admins (admin/super_admin roles)
- Users with company access AND specific roles (finance, warehouse, or manager)

This prevents regular authenticated users from viewing assets and downloading their QR codes.

## Current RLS Policies

| Table | Policy | Current Access |
|-------|--------|----------------|
| `warehouse_assets` | "Authenticated users can view warehouse assets" | All authenticated users (auth.uid() IS NOT NULL) |
| `asset_master` | "Company users and admins can view asset master" | Admins OR (company match + specific roles) |

## Solution

Update the `asset_master` SELECT policy to allow ALL authenticated users to view asset records, matching the existing `warehouse_assets` policy behavior.

## Changes Required

**New Migration File**

Create a migration that:
1. Drops the current restrictive SELECT policy
2. Creates a new policy allowing all authenticated users to view asset_master records

```sql
-- Drop existing restrictive SELECT policy
DROP POLICY IF EXISTS "Company users and admins can view asset master" ON asset_master;

-- Create new policy allowing all authenticated users to view
CREATE POLICY "Authenticated users can view asset master"
ON asset_master FOR SELECT
USING (auth.uid() IS NOT NULL);
```

## Security Considerations

- **SELECT (read)**: All authenticated users can view asset master records
- **INSERT/UPDATE/DELETE**: Unchanged - still restricted to creators and admins

This change is safe because:
1. It only affects read access, not write operations
2. Users must still be authenticated (logged in)
3. Other policies (INSERT, UPDATE, DELETE) remain unchanged
4. This matches the existing `warehouse_assets` policy pattern

## Files to Create

| File | Action | Description |
|------|--------|-------------|
| `supabase/migrations/[timestamp]_authenticated_users_view_asset_master.sql` | Create | Update SELECT policy to allow all authenticated users |

## Expected Outcome

After this change:
- All logged-in users can view asset master records
- All logged-in users can download QR codes for any asset
- QR code generation (PDF, PNG, Print) will work for all authenticated users
- Write operations (create/edit/delete) remain restricted to appropriate roles
