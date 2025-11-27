-- Remove duplicate profile view policy
DROP POLICY IF EXISTS "Users can view their own profile only" ON profiles;