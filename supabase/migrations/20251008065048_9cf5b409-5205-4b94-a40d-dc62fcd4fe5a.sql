-- Drop all existing policies on user_roles that might cause recursion
DROP POLICY IF EXISTS "Users can view their own roles, admins can view all" ON public.user_roles;
DROP POLICY IF EXISTS "Users can view their own roles" ON public.user_roles;
DROP POLICY IF EXISTS "Admins can view user roles in their company" ON public.user_roles;
DROP POLICY IF EXISTS "Super admins can view all user roles" ON public.user_roles;
DROP POLICY IF EXISTS "Admins can view all user roles" ON public.user_roles;
DROP POLICY IF EXISTS "Users can manage their own roles" ON public.user_roles;
DROP POLICY IF EXISTS "Admins can assign roles" ON public.user_roles;
DROP POLICY IF EXISTS "Super admins can assign roles" ON public.user_roles;
DROP POLICY IF EXISTS "Admins can manage user roles" ON public.user_roles;
DROP POLICY IF EXISTS "Super admins can manage user roles" ON public.user_roles;

-- Create simple non-recursive SELECT policy for user_roles
-- Users can view their own roles, admins can view all roles
CREATE POLICY "Users can view own roles or admins view all"
ON public.user_roles
FOR SELECT
USING (auth.uid() = user_id OR is_admin(auth.uid()));

-- Allow admins to insert/update/delete user roles
CREATE POLICY "Admins manage all user roles"
ON public.user_roles
FOR ALL
USING (is_admin(auth.uid()))
WITH CHECK (is_admin(auth.uid()));