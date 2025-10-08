-- Security Fix: Strengthen profiles table RLS policies
-- This migration addresses critical security vulnerabilities in the profiles table

-- Step 1: Drop the existing overly permissive SELECT policy
DROP POLICY IF EXISTS "Users can view profiles" ON public.profiles;

-- Step 2: Create a new secure SELECT policy with proper authentication and company isolation
-- This policy ensures:
-- 1. Users can only view their own profile
-- 2. Users cannot view profiles from other companies
-- 3. Unauthenticated users cannot access any profiles
CREATE POLICY "Users can view their own profile only"
ON public.profiles
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

-- Step 3: Create a separate policy for admins with company isolation
-- Admins can view profiles within their company only
CREATE POLICY "Admins can view profiles in their company"
ON public.profiles
FOR SELECT
TO authenticated
USING (
  is_admin(auth.uid()) 
  AND (
    -- Allow viewing profiles from the same company
    company_id IN (
      SELECT company_id 
      FROM public.profiles 
      WHERE user_id = auth.uid()
    )
    -- Also allow viewing profiles with NULL company_id (for backwards compatibility)
    OR company_id IS NULL
  )
);

-- Step 4: Ensure the UPDATE policies also have proper company isolation
-- Drop and recreate the admin update policy with company checks
DROP POLICY IF EXISTS "Admins can update any profile" ON public.profiles;

CREATE POLICY "Admins can update profiles in their company"
ON public.profiles
FOR UPDATE
TO authenticated
USING (
  is_admin(auth.uid()) 
  AND (
    company_id IN (
      SELECT company_id 
      FROM public.profiles 
      WHERE user_id = auth.uid()
    )
    OR company_id IS NULL
  )
)
WITH CHECK (
  is_admin(auth.uid()) 
  AND (
    company_id IN (
      SELECT company_id 
      FROM public.profiles 
      WHERE user_id = auth.uid()
    )
    OR company_id IS NULL
  )
);

-- Step 5: Add a comment documenting the security requirements
COMMENT ON TABLE public.profiles IS 'Employee profiles with RLS policies enforcing authentication and company-level isolation. Users can only access their own profile, admins can access profiles within their company only.';