-- First, create a security definer function to check if user is in same company
CREATE OR REPLACE FUNCTION public.is_same_company(_target_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles p1
    JOIN public.profiles p2 ON p1.company_id = p2.company_id
    WHERE p1.user_id = auth.uid()
      AND p2.user_id = _target_user_id
      AND p1.company_id IS NOT NULL
  )
$$;

-- Drop the overly permissive "Admins can view all profiles" policy
DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;

-- Drop the overly permissive "Admins can update all profiles" policy
DROP POLICY IF EXISTS "Admins can update all profiles" ON public.profiles;

-- Create new restrictive policy: Admins can only view profiles within their company
CREATE POLICY "Admins can view profiles in their company"
  ON public.profiles
  FOR SELECT
  USING (
    is_admin(auth.uid()) 
    AND NOT is_super_admin(auth.uid())
    AND public.is_same_company(user_id)
  );

-- Create new restrictive policy: Admins can only update profiles within their company
CREATE POLICY "Admins can update profiles in their company"
  ON public.profiles
  FOR UPDATE
  USING (
    is_admin(auth.uid()) 
    AND NOT is_super_admin(auth.uid())
    AND public.is_same_company(user_id)
  )
  WITH CHECK (
    is_admin(auth.uid()) 
    AND NOT is_super_admin(auth.uid())
    AND public.is_same_company(user_id)
  );

-- Add comment for documentation
COMMENT ON FUNCTION public.is_same_company IS 'Security definer function to check if current user is in the same company as target user. Used for RLS policies to restrict cross-company data access.';