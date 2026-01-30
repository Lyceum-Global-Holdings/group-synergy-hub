-- Drop existing conflicting/duplicate SELECT policies on asset_master
DROP POLICY IF EXISTS "Finance and asset managers can view assets" ON asset_master;
DROP POLICY IF EXISTS "Finance and management can view asset master" ON asset_master;

-- Create a single, unified SELECT policy
-- Admins (including super_admins) can see ALL assets regardless of company
-- Other roles (finance, warehouse, manager) require company match
CREATE POLICY "Company users and admins can view asset master"
ON asset_master FOR SELECT
USING (
  -- Super admins and admins can see ALL assets (any company)
  is_admin(auth.uid()) 
  OR
  -- Other roles require company match plus specific role access
  (can_access_company(company_id) AND 
   (has_finance_access(auth.uid()) OR 
    has_warehouse_access(auth.uid()) OR
    has_manager_access(auth.uid())))
);