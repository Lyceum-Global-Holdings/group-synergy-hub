-- =====================================================
-- Security Hardening: Restrict sensitive data access
-- =====================================================

-- 1. supplier_invoices: Restrict SELECT to finance/procurement users
-- Currently: USING (true) - too permissive
DROP POLICY IF EXISTS "Users can view supplier invoices" ON public.supplier_invoices;

CREATE POLICY "Finance or Procurement users can view supplier invoices"
ON public.supplier_invoices FOR SELECT
TO authenticated
USING (
  is_super_admin(auth.uid()) OR
  (
    can_access_company(company_id) AND 
    (has_finance_access(auth.uid()) OR has_procurement_access(auth.uid()) OR is_admin(auth.uid()))
  )
);

-- 2. asset_master: Restrict SELECT to finance/management users for financial data
-- Currently: only requires auth.uid() IS NOT NULL - too permissive for sensitive financial data
DROP POLICY IF EXISTS "Authenticated users can view asset master" ON public.asset_master;

CREATE POLICY "Finance and management can view asset master"
ON public.asset_master FOR SELECT
TO authenticated
USING (
  is_super_admin(auth.uid()) OR
  (
    can_access_company(company_id) AND 
    (has_finance_access(auth.uid()) OR has_manager_access(auth.uid()) OR is_admin(auth.uid()))
  )
);

-- 3. warehouse_items: Restrict SELECT to warehouse/procurement/finance users
-- Unit costs and pricing data should be restricted
DROP POLICY IF EXISTS "Authenticated users can view warehouse items" ON public.warehouse_items;

CREATE POLICY "Warehouse and procurement users can view warehouse items"
ON public.warehouse_items FOR SELECT
TO authenticated
USING (
  is_super_admin(auth.uid()) OR
  (
    can_access_company(company_id) AND 
    (has_warehouse_access(auth.uid()) OR has_procurement_access(auth.uid()) OR has_finance_access(auth.uid()) OR is_admin(auth.uid()))
  )
);

-- 4. bank_transactions: Restrict SELECT to finance users (currently USING true)
DROP POLICY IF EXISTS "Users can view bank transactions" ON public.bank_transactions;

CREATE POLICY "Finance users can view bank transactions"
ON public.bank_transactions FOR SELECT
TO authenticated
USING (
  is_super_admin(auth.uid()) OR
  (
    can_access_company(company_id) AND 
    (has_finance_access(auth.uid()) OR is_admin(auth.uid()))
  )
);

-- 5. bank_statements: Restrict SELECT to finance users (currently USING true)
DROP POLICY IF EXISTS "Users can view bank statements" ON public.bank_statements;

CREATE POLICY "Finance users can view bank statements"
ON public.bank_statements FOR SELECT
TO authenticated
USING (
  is_super_admin(auth.uid()) OR
  (
    can_access_company(company_id) AND 
    (has_finance_access(auth.uid()) OR is_admin(auth.uid()))
  )
);

-- 6. bank_reconciliations: Restrict SELECT to finance users (currently USING true)
DROP POLICY IF EXISTS "Users can view bank reconciliations" ON public.bank_reconciliations;

CREATE POLICY "Finance users can view bank reconciliations"
ON public.bank_reconciliations FOR SELECT
TO authenticated
USING (
  is_super_admin(auth.uid()) OR
  (
    can_access_company(company_id) AND 
    (has_finance_access(auth.uid()) OR is_admin(auth.uid()))
  )
);

-- 7. asset_transactions: Restrict SELECT to finance users (currently USING true)
DROP POLICY IF EXISTS "Users can view asset transactions" ON public.asset_transactions;

CREATE POLICY "Finance users can view asset transactions"
ON public.asset_transactions FOR SELECT
TO authenticated
USING (
  is_super_admin(auth.uid()) OR
  (
    can_access_company(company_id) AND 
    (has_finance_access(auth.uid()) OR is_admin(auth.uid()))
  )
);