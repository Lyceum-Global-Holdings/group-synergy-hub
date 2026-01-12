-- Fix profiles RLS to allow same-company users to view each other's basic profiles
-- while maintaining proper isolation between companies

-- First, let's add a policy for regular authenticated users to view profiles within their company
-- This is a common requirement for team visibility

-- Drop existing user self-view policy (will recreate with better scope)
DROP POLICY IF EXISTS "Users can view their own profile" ON public.profiles;

-- Create a comprehensive same-company view policy for all authenticated users
-- This replaces multiple overlapping SELECT policies with clearer logic
CREATE POLICY "Users can view profiles in their company"
ON public.profiles
FOR SELECT
USING (
  -- User can always view their own profile
  auth.uid() = user_id
  OR
  -- User can view profiles of other users in the same company
  (
    auth.uid() IS NOT NULL
    AND company_id IS NOT NULL
    AND company_id IN (
      SELECT p.company_id 
      FROM public.profiles p 
      WHERE p.user_id = auth.uid() 
      AND p.company_id IS NOT NULL
    )
  )
);

-- Note: Super admins policy remains separate to allow viewing all profiles
-- Note: Admin policies remain for their specific company access pattern