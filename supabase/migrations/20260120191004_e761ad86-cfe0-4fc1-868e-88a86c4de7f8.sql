-- Phase 1: Fix infinite recursion on profiles table
DROP POLICY IF EXISTS "Users can view company profiles" ON public.profiles;

CREATE POLICY "Users can view company profiles"
ON public.profiles FOR SELECT
TO authenticated
USING (
  company_id = get_user_company_id(auth.uid())
);

-- Phase 2: Remove duplicate policies
DROP POLICY IF EXISTS "Users can insert their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;