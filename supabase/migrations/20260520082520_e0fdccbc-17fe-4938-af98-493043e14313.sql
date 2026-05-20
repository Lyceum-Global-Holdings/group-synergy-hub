DROP POLICY IF EXISTS "Users can view their own company" ON public.companies;

CREATE POLICY "Users can view their accessible companies"
ON public.companies
FOR SELECT
USING (
  is_super_admin((SELECT auth.uid())) 
  OR is_admin((SELECT auth.uid()))
  OR id IN (SELECT company_id FROM profiles WHERE user_id = (SELECT auth.uid()))
  OR id IN (SELECT company_id FROM user_company_access WHERE user_id = (SELECT auth.uid()))
);