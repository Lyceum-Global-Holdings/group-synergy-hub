-- Fix profiles table RLS to restrict visibility to same-company users only

-- Remove the overly permissive policy that allows any authenticated user to view profiles
DROP POLICY IF EXISTS "Users can view profiles in their company" ON profiles;

-- The following policies should remain:
-- "Users can view own profile" - users can always see their own profile
-- "Users can view company profiles" - uses get_user_company_id(auth.uid()) correctly
-- "Admins can view company profiles" - admins can see profiles in their company
-- "Super admins can view all profiles" - super admins have full access

-- Verify "Users can view company profiles" exists with correct restriction
-- If not, create it with proper company isolation
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'profiles' 
    AND policyname = 'Users can view company profiles'
  ) THEN
    CREATE POLICY "Users can view company profiles"
    ON profiles FOR SELECT
    TO authenticated
    USING (company_id = get_user_company_id(auth.uid()));
  END IF;
END $$;