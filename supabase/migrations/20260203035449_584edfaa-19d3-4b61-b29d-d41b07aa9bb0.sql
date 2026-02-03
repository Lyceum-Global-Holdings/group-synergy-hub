-- Ensure suppliers table is restricted to procurement, finance, and manager roles only
-- Remove any overly permissive policies first

DROP POLICY IF EXISTS "Authenticated users can view suppliers" ON suppliers;
DROP POLICY IF EXISTS "Company users can view suppliers" ON suppliers;
DROP POLICY IF EXISTS "Authorized users can view suppliers" ON suppliers;
DROP POLICY IF EXISTS "Users can view suppliers" ON suppliers;

CREATE POLICY "Authorized users can view suppliers"
ON suppliers FOR SELECT
USING (
  is_admin(auth.uid()) OR
  (can_access_company(company_id) AND 
   (has_procurement_access(auth.uid()) OR 
    has_finance_access(auth.uid()) OR
    has_manager_access(auth.uid())))
);