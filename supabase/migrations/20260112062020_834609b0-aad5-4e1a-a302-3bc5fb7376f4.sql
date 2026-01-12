-- Create a security definer function that can safely query profiles
-- This function bypasses RLS, preventing infinite recursion
CREATE OR REPLACE FUNCTION get_user_company_id(_user_id uuid)
RETURNS uuid
SECURITY DEFINER
SET search_path = public
LANGUAGE sql
STABLE
AS $$
  SELECT company_id FROM profiles WHERE user_id = _user_id LIMIT 1;
$$;

-- Drop the problematic policies that cause infinite recursion
DROP POLICY IF EXISTS "Admins can view profiles in their company" ON profiles;
DROP POLICY IF EXISTS "Users can view profiles in their company" ON profiles;
DROP POLICY IF EXISTS "Admins can update profiles in their company" ON profiles;

-- Recreate "Users can view profiles in their company" without recursion
CREATE POLICY "Users can view profiles in their company"
ON profiles FOR SELECT
TO public
USING (
  (auth.uid() = user_id)
  OR (
    auth.uid() IS NOT NULL
    AND company_id IS NOT NULL
    AND company_id = get_user_company_id(auth.uid())
  )
);

-- Recreate "Admins can view profiles in their company" using the safe function
CREATE POLICY "Admins can view profiles in their company"
ON profiles FOR SELECT
TO public
USING (
  is_admin(auth.uid())
  AND NOT is_super_admin(auth.uid())
  AND (
    company_id IS NULL
    OR company_id = get_user_company_id(auth.uid())
  )
);

-- Recreate "Admins can update profiles in their company" using the safe function
CREATE POLICY "Admins can update profiles in their company"
ON profiles FOR UPDATE
TO public
USING (
  is_admin(auth.uid())
  AND NOT is_super_admin(auth.uid())
  AND (
    company_id IS NULL
    OR company_id = get_user_company_id(auth.uid())
  )
);