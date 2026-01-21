-- Fix suppliers table RLS policies to restrict access to same-company users with procurement access

-- Drop existing policies
DROP POLICY IF EXISTS "Users can view suppliers in their company" ON public.suppliers;
DROP POLICY IF EXISTS "Users can create suppliers in their company" ON public.suppliers;
DROP POLICY IF EXISTS "Users can update suppliers in their company" ON public.suppliers;
DROP POLICY IF EXISTS "Admins can delete suppliers" ON public.suppliers;

-- SELECT: Only users within the same company with procurement or finance access can view suppliers
CREATE POLICY "Users can view suppliers in their company"
ON public.suppliers FOR SELECT
TO authenticated
USING (
  is_super_admin(auth.uid()) OR 
  (
    can_access_company(company_id) AND 
    (has_procurement_access(auth.uid()) OR has_finance_access(auth.uid()) OR is_admin(auth.uid()))
  )
);

-- INSERT: Only procurement/finance users can create suppliers within their company
CREATE POLICY "Users can create suppliers in their company"
ON public.suppliers FOR INSERT
TO authenticated
WITH CHECK (
  is_super_admin(auth.uid()) OR
  (
    can_access_company(company_id) AND 
    (has_procurement_access(auth.uid()) OR has_finance_access(auth.uid()) OR is_admin(auth.uid()))
  )
);

-- UPDATE: Only procurement/finance users can update suppliers within their company
CREATE POLICY "Users can update suppliers in their company"
ON public.suppliers FOR UPDATE
TO authenticated
USING (
  is_super_admin(auth.uid()) OR
  (
    can_access_company(company_id) AND 
    (has_procurement_access(auth.uid()) OR has_finance_access(auth.uid()) OR is_admin(auth.uid()))
  )
)
WITH CHECK (
  is_super_admin(auth.uid()) OR
  (
    can_access_company(company_id) AND 
    (has_procurement_access(auth.uid()) OR has_finance_access(auth.uid()) OR is_admin(auth.uid()))
  )
);

-- DELETE: Only admins can delete suppliers within their company
CREATE POLICY "Admins can delete suppliers"
ON public.suppliers FOR DELETE
TO authenticated
USING (
  is_super_admin(auth.uid()) OR
  (can_access_company(company_id) AND is_admin(auth.uid()))
);