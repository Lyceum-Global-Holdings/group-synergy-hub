-- Drop the misconfigured policy that only applies to dashboard_user role
DROP POLICY IF EXISTS "dashboard_user_select_user_roles" ON public.user_roles;

-- Create a proper policy for authenticated users to view their own roles
CREATE POLICY "Users can view their own roles"
ON public.user_roles
FOR SELECT
TO authenticated
USING (user_id = auth.uid());

-- Allow admins to view all user roles (needed for user management panel)
CREATE POLICY "Admins can view all user roles"
ON public.user_roles
FOR SELECT
TO authenticated
USING (public.is_admin(auth.uid()));