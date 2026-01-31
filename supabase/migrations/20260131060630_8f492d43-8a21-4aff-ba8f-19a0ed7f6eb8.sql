-- Drop existing restrictive SELECT policy
DROP POLICY IF EXISTS "Company users and admins can view asset master" ON asset_master;

-- Create new policy allowing all authenticated users to view
CREATE POLICY "Authenticated users can view asset master"
ON asset_master FOR SELECT
USING (auth.uid() IS NOT NULL);