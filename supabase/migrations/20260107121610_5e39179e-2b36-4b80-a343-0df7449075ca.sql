-- Drop existing restrictive policy on warehouse_tools
DROP POLICY IF EXISTS "Users can view tools in their assigned locations" ON warehouse_tools;

-- Create new policy allowing all authenticated users to view all tools
CREATE POLICY "Users can view warehouse tools"
ON warehouse_tools
FOR SELECT
TO authenticated
USING (true);