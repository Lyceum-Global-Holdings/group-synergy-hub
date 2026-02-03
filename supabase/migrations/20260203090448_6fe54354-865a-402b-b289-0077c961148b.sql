-- Fix profiles table public exposure
-- Revoke all anonymous access to profiles table

REVOKE ALL ON public.profiles FROM anon;

-- Ensure only authenticated users can access profiles
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;

-- Add explicit policy to deny anonymous access (belt and suspenders approach)
-- Drop and recreate the main SELECT policy to ensure it's clean
DROP POLICY IF EXISTS "Users can view colleague basic info" ON public.profiles;
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
DROP POLICY IF EXISTS "Admins can view company profiles" ON public.profiles;
DROP POLICY IF EXISTS "Super admins can view all profiles" ON public.profiles;

-- Recreate consolidated SELECT policy for authenticated users only
-- Users can view their own profile or profiles within their company
CREATE POLICY "Authenticated users can view profiles"
ON public.profiles
FOR SELECT
TO authenticated
USING (
  user_id = auth.uid()  -- Own profile
  OR is_super_admin(auth.uid())  -- Super admins see all
  OR (is_admin(auth.uid()) AND can_access_company(company_id))  -- Company admins
  OR company_id = get_user_company_id(auth.uid())  -- Same company colleagues
);

-- Force RLS for table owner as well (extra security)
ALTER TABLE public.profiles FORCE ROW LEVEL SECURITY;