-- Fix profiles table RLS policies to ensure proper company isolation

-- Drop problematic policies
DROP POLICY IF EXISTS "Admins can update all profiles" ON public.profiles;

-- Recreate admin update policy with proper company check
CREATE POLICY "Admins can update company profiles"
ON public.profiles FOR UPDATE
TO authenticated
USING (
  is_super_admin(auth.uid()) OR
  (
    can_access_company(company_id) AND 
    is_admin(auth.uid())
  )
)
WITH CHECK (
  is_super_admin(auth.uid()) OR
  (
    can_access_company(company_id) AND 
    is_admin(auth.uid())
  )
);