DROP POLICY IF EXISTS "Admins can delete warehouse assets" ON warehouse_assets;
CREATE POLICY "Authorized users can delete warehouse assets" 
  ON warehouse_assets FOR DELETE 
  USING (
    is_admin(auth.uid()) 
    OR (auth.uid() = created_by)
    OR (can_access_company(company_id) AND has_warehouse_access(auth.uid()))
  );