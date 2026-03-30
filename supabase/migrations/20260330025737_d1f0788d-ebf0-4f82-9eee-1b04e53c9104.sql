-- Fix asset_revaluations SELECT policy - replace broken company check with can_access_company
DROP POLICY IF EXISTS "Users can view asset revaluations for their company" ON asset_revaluations;
CREATE POLICY "Users can view asset revaluations for their company"
  ON asset_revaluations FOR SELECT TO authenticated
  USING (can_access_company(company_id));

-- Fix asset_revaluations INSERT policy
DROP POLICY IF EXISTS "Users can insert asset revaluations" ON asset_revaluations;
CREATE POLICY "Users can insert asset revaluations"
  ON asset_revaluations FOR INSERT TO authenticated
  WITH CHECK (can_access_company(company_id) AND (has_finance_access(auth.uid()) OR is_admin(auth.uid())));

-- Fix asset_disposals SELECT policy
DROP POLICY IF EXISTS "Users can view asset disposals for their company" ON asset_disposals;
CREATE POLICY "Users can view asset disposals for their company"
  ON asset_disposals FOR SELECT TO authenticated
  USING (can_access_company(company_id));

-- Fix asset_disposals INSERT policy
DROP POLICY IF EXISTS "Users can insert asset disposals" ON asset_disposals;
CREATE POLICY "Users can insert asset disposals"
  ON asset_disposals FOR INSERT TO authenticated
  WITH CHECK (can_access_company(company_id) AND (has_finance_access(auth.uid()) OR is_admin(auth.uid())));