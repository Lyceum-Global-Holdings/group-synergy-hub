-- Drop existing restrictive policies for profiles
DROP POLICY IF EXISTS "Admins can view profiles in their company" ON public.profiles;
DROP POLICY IF EXISTS "Admins can update profiles in their company" ON public.profiles;

-- Create new policies that allow super admins to access all profiles
CREATE POLICY "Super admins can view all profiles"
ON public.profiles
FOR SELECT
TO authenticated
USING (is_super_admin(auth.uid()));

CREATE POLICY "Admins can view profiles in their company"
ON public.profiles
FOR SELECT
TO authenticated
USING (
  is_admin(auth.uid()) 
  AND NOT is_super_admin(auth.uid())
  AND (
    company_id IN (
      SELECT company_id FROM profiles WHERE user_id = auth.uid()
    ) 
    OR company_id IS NULL
  )
);

CREATE POLICY "Super admins can update all profiles"
ON public.profiles
FOR UPDATE
TO authenticated
USING (is_super_admin(auth.uid()))
WITH CHECK (is_super_admin(auth.uid()));

CREATE POLICY "Admins can update profiles in their company"
ON public.profiles
FOR UPDATE
TO authenticated
USING (
  is_admin(auth.uid()) 
  AND NOT is_super_admin(auth.uid())
  AND (
    company_id IN (
      SELECT company_id FROM profiles WHERE user_id = auth.uid()
    ) 
    OR company_id IS NULL
  )
)
WITH CHECK (
  is_admin(auth.uid()) 
  AND NOT is_super_admin(auth.uid())
  AND (
    company_id IN (
      SELECT company_id FROM profiles WHERE user_id = auth.uid()
    ) 
    OR company_id IS NULL
  )
);

-- Ensure super admins can create profiles for any company
CREATE POLICY "Super admins can insert profiles for any company"
ON public.profiles
FOR INSERT
TO authenticated
WITH CHECK (is_super_admin(auth.uid()));

-- Update user_roles policies to allow super admins full access
DROP POLICY IF EXISTS "Admins can view all user roles" ON public.user_roles;

CREATE POLICY "Super admins can view all user roles"
ON public.user_roles
FOR SELECT
TO authenticated
USING (is_super_admin(auth.uid()));

CREATE POLICY "Admins can view user roles in their company"
ON public.user_roles
FOR SELECT
TO authenticated
USING (
  is_admin(auth.uid()) 
  AND NOT is_super_admin(auth.uid())
  AND EXISTS (
    SELECT 1 FROM profiles 
    WHERE profiles.user_id = user_roles.user_id 
    AND profiles.company_id IN (
      SELECT company_id FROM profiles WHERE user_id = auth.uid()
    )
  )
);