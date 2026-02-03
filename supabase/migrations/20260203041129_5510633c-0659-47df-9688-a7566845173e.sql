-- Fix profiles table RLS policies - require authentication for all access
-- Remove policies that are assigned to 'public' role (unauthenticated access risk)

-- Drop the problematic policies assigned to public role
DROP POLICY IF EXISTS "Super admins can insert profiles" ON profiles;
DROP POLICY IF EXISTS "Super admins can update all profiles" ON profiles;
DROP POLICY IF EXISTS "Super admins can view all profiles" ON profiles;

-- Recreate these policies requiring authentication
CREATE POLICY "Super admins can insert profiles"
ON profiles FOR INSERT
TO authenticated
WITH CHECK (is_super_admin(auth.uid()));

CREATE POLICY "Super admins can update all profiles"
ON profiles FOR UPDATE
TO authenticated
USING (is_super_admin(auth.uid()))
WITH CHECK (is_super_admin(auth.uid()));

CREATE POLICY "Super admins can view all profiles"
ON profiles FOR SELECT
TO authenticated
USING (is_super_admin(auth.uid()));