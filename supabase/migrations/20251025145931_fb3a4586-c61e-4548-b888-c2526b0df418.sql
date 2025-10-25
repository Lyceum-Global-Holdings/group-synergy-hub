-- Restrict user deletion to super admins only

-- Add DELETE policy for profiles table
CREATE POLICY "Only super admins can delete profiles"
ON public.profiles
FOR DELETE
TO authenticated
USING (is_super_admin(auth.uid()));

-- Drop existing user_roles DELETE policy if exists
DROP POLICY IF EXISTS "Only admins can remove role assignments" ON public.user_roles;

-- Create new super admin-only policy for deleting user_roles
CREATE POLICY "Only super admins can delete user roles"
ON public.user_roles
FOR DELETE
TO authenticated
USING (is_super_admin(auth.uid()));