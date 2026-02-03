-- Tighten construction_labour_master to HR and senior management only
-- EPF numbers and salary rates are sensitive - restrict beyond general construction access

DROP POLICY IF EXISTS "HR and managers can view labour master" ON construction_labour_master;

CREATE POLICY "HR and senior management can view labour master"
ON construction_labour_master FOR SELECT
USING (
  is_admin(auth.uid()) OR
  (can_access_company(company_id) AND 
   (has_hr_access(auth.uid()) OR has_senior_finance_access(auth.uid())))
);