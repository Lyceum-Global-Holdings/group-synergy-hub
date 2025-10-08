-- Create security definer function to get user's company IDs without recursion
CREATE OR REPLACE FUNCTION public.get_user_company_ids(_user_id uuid)
RETURNS uuid[]
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT ARRAY_AGG(company_id)
  FROM public.profiles
  WHERE user_id = _user_id AND company_id IS NOT NULL
$$;

-- Drop all existing policies on profiles
DROP POLICY IF EXISTS "Super admins can view all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Admins can view profiles in their company" ON public.profiles;
DROP POLICY IF EXISTS "Super admins can update all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Admins can update profiles in their company" ON public.profiles;
DROP POLICY IF EXISTS "Super admins can insert profiles for any company" ON public.profiles;
DROP POLICY IF EXISTS "Users can view their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;

-- Create new non-recursive policies for profiles
CREATE POLICY "Super admins can view all profiles"
ON public.profiles
FOR SELECT
USING (is_super_admin(auth.uid()));

CREATE POLICY "Admins can view profiles in their company"
ON public.profiles
FOR SELECT
USING (
  is_admin(auth.uid()) 
  AND NOT is_super_admin(auth.uid())
  AND (company_id = ANY(public.get_user_company_ids(auth.uid())) OR company_id IS NULL)
);

CREATE POLICY "Users can view their own profile"
ON public.profiles
FOR SELECT
USING (user_id = auth.uid());

CREATE POLICY "Super admins can update all profiles"
ON public.profiles
FOR UPDATE
USING (is_super_admin(auth.uid()))
WITH CHECK (is_super_admin(auth.uid()));

CREATE POLICY "Admins can update profiles in their company"
ON public.profiles
FOR UPDATE
USING (
  is_admin(auth.uid()) 
  AND NOT is_super_admin(auth.uid())
  AND (company_id = ANY(public.get_user_company_ids(auth.uid())) OR company_id IS NULL)
)
WITH CHECK (
  is_admin(auth.uid()) 
  AND NOT is_super_admin(auth.uid())
  AND (company_id = ANY(public.get_user_company_ids(auth.uid())) OR company_id IS NULL)
);

CREATE POLICY "Users can update their own profile"
ON public.profiles
FOR UPDATE
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

CREATE POLICY "Super admins can insert profiles"
ON public.profiles
FOR INSERT
WITH CHECK (is_super_admin(auth.uid()));

-- Drop and recreate user_roles policies
DROP POLICY IF EXISTS "Super admins can view all user roles" ON public.user_roles;
DROP POLICY IF EXISTS "Admins can view user roles in their company" ON public.user_roles;

CREATE POLICY "Super admins can view all user roles"
ON public.user_roles
FOR SELECT
USING (is_super_admin(auth.uid()));

CREATE POLICY "Admins can view user roles in their company"
ON public.user_roles
FOR SELECT
USING (
  is_admin(auth.uid()) 
  AND NOT is_super_admin(auth.uid())
  AND user_id IN (
    SELECT p.user_id 
    FROM public.profiles p
    WHERE p.company_id = ANY(public.get_user_company_ids(auth.uid()))
  )
);