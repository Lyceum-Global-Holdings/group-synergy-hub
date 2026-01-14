-- Drop the restrictive admin policies that limit to their own company
DROP POLICY IF EXISTS "Admins can view profiles in their company" ON public.profiles;
DROP POLICY IF EXISTS "Admins can update profiles in their company" ON public.profiles;

-- Create new policies allowing admins to view ALL profiles across ALL companies
CREATE POLICY "Admins can view all profiles" ON public.profiles
  FOR SELECT
  USING (is_admin(auth.uid()));

-- Create new policy allowing admins to update ALL profiles across ALL companies
CREATE POLICY "Admins can update all profiles" ON public.profiles
  FOR UPDATE
  USING (is_admin(auth.uid()))
  WITH CHECK (is_admin(auth.uid()));