-- Security Hardening Phase 4 - Final Security Tightening (Fixed)

-- ============================================
-- PART 1: New Helper Functions for Role Access
-- ============================================

-- Warehouse access helper
CREATE OR REPLACE FUNCTION public.has_warehouse_access(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles ur
    JOIN public.roles r ON ur.role_id = r.id
    WHERE ur.user_id = _user_id
    AND (r.app_role IN ('admin', 'super_admin') 
         OR r.department = 'Warehouse'
         OR r.name ILIKE '%warehouse%'
         OR r.name ILIKE '%inventory%'
         OR r.name ILIKE '%stock%')
  ) OR public.is_admin(_user_id);
$$;

-- HR access helper
CREATE OR REPLACE FUNCTION public.has_hr_access(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles ur
    JOIN public.roles r ON ur.role_id = r.id
    WHERE ur.user_id = _user_id
    AND (r.app_role IN ('admin', 'super_admin') 
         OR r.department = 'HR'
         OR r.name ILIKE '%hr%'
         OR r.name ILIKE '%human%')
  ) OR public.is_admin(_user_id);
$$;

-- ============================================
-- PART 2: Fix Financial Tables (Finance Role)
-- ============================================

-- supplier_payments
DROP POLICY IF EXISTS "Users can view supplier payments" ON public.supplier_payments;
DROP POLICY IF EXISTS "Finance users can view supplier payments" ON public.supplier_payments;
CREATE POLICY "Finance users can view supplier payments"
ON public.supplier_payments FOR SELECT
USING (can_access_company(company_id) AND has_finance_access(auth.uid()));

-- customer_receipts
DROP POLICY IF EXISTS "Users can view customer receipts" ON public.customer_receipts;
DROP POLICY IF EXISTS "Finance users can view customer receipts" ON public.customer_receipts;
CREATE POLICY "Finance users can view customer receipts"
ON public.customer_receipts FOR SELECT
USING (can_access_company(company_id) AND has_finance_access(auth.uid()));

-- payment_allocations
DROP POLICY IF EXISTS "Users can view payment allocations" ON public.payment_allocations;
DROP POLICY IF EXISTS "Finance users can view payment allocations" ON public.payment_allocations;
CREATE POLICY "Finance users can view payment allocations"
ON public.payment_allocations FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.supplier_payments sp
    WHERE sp.id = payment_allocations.payment_id
    AND can_access_company(sp.company_id)
  ) AND has_finance_access(auth.uid())
);

-- receipt_allocations
DROP POLICY IF EXISTS "Users can view receipt allocations" ON public.receipt_allocations;
DROP POLICY IF EXISTS "Finance users can view receipt allocations" ON public.receipt_allocations;
CREATE POLICY "Finance users can view receipt allocations"
ON public.receipt_allocations FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.customer_receipts cr
    WHERE cr.id = receipt_allocations.receipt_id
    AND can_access_company(cr.company_id)
  ) AND has_finance_access(auth.uid())
);

-- depreciation_schedule
DROP POLICY IF EXISTS "Users can view depreciation schedule" ON public.depreciation_schedule;
DROP POLICY IF EXISTS "Finance users can view depreciation schedule" ON public.depreciation_schedule;
CREATE POLICY "Finance users can view depreciation schedule"
ON public.depreciation_schedule FOR SELECT
USING (can_access_company(company_id) AND has_finance_access(auth.uid()));

-- budgets
DROP POLICY IF EXISTS "Users can view budgets" ON public.budgets;
DROP POLICY IF EXISTS "Finance users can view budgets" ON public.budgets;
CREATE POLICY "Finance users can view budgets"
ON public.budgets FOR SELECT
USING (can_access_company(company_id) AND has_finance_access(auth.uid()));

-- budget_lines
DROP POLICY IF EXISTS "Users can view budget lines" ON public.budget_lines;
DROP POLICY IF EXISTS "Finance users can view budget lines" ON public.budget_lines;
CREATE POLICY "Finance users can view budget lines"
ON public.budget_lines FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.budgets b
    WHERE b.id = budget_lines.budget_id
    AND can_access_company(b.company_id)
  ) AND has_finance_access(auth.uid())
);

-- budget_transactions (FIXED: use budget_item_id)
DROP POLICY IF EXISTS "Users can view budget transactions" ON public.budget_transactions;
DROP POLICY IF EXISTS "Finance users can view budget transactions" ON public.budget_transactions;
CREATE POLICY "Finance users can view budget transactions"
ON public.budget_transactions FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.budget_lines bl
    JOIN public.budgets b ON b.id = bl.budget_id
    WHERE bl.id = budget_transactions.budget_item_id
    AND can_access_company(b.company_id)
  ) AND has_finance_access(auth.uid())
);

-- profit_centers
DROP POLICY IF EXISTS "Users can view profit centers" ON public.profit_centers;
DROP POLICY IF EXISTS "Finance users can view profit centers" ON public.profit_centers;
CREATE POLICY "Finance users can view profit centers"
ON public.profit_centers FOR SELECT
USING (can_access_company(company_id) AND has_finance_access(auth.uid()));

-- ============================================
-- PART 3: Fix Sales/Customer Tables
-- ============================================

-- customers - Sales and Finance access
DROP POLICY IF EXISTS "Users can view customers" ON public.customers;
DROP POLICY IF EXISTS "Sales and finance can view customers" ON public.customers;
CREATE POLICY "Sales and finance can view customers"
ON public.customers FOR SELECT
USING (can_access_company(company_id) AND (has_sales_access(auth.uid()) OR has_finance_access(auth.uid())));

-- customer_invoices
DROP POLICY IF EXISTS "Users can view customer invoices" ON public.customer_invoices;
DROP POLICY IF EXISTS "Sales and finance can view customer invoices" ON public.customer_invoices;
CREATE POLICY "Sales and finance can view customer invoices"
ON public.customer_invoices FOR SELECT
USING (can_access_company(company_id) AND (has_sales_access(auth.uid()) OR has_finance_access(auth.uid())));

-- customer_invoice_lines
DROP POLICY IF EXISTS "Users can view customer invoice lines" ON public.customer_invoice_lines;
DROP POLICY IF EXISTS "Sales and finance can view customer invoice lines" ON public.customer_invoice_lines;
CREATE POLICY "Sales and finance can view customer invoice lines"
ON public.customer_invoice_lines FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.customer_invoices ci
    WHERE ci.id = customer_invoice_lines.invoice_id
    AND can_access_company(ci.company_id)
  ) AND (has_sales_access(auth.uid()) OR has_finance_access(auth.uid()))
);

-- ============================================
-- PART 4: Fix Construction Tables
-- ============================================

-- construction_documents
DROP POLICY IF EXISTS "Authenticated users can view construction documents" ON public.construction_documents;
DROP POLICY IF EXISTS "Construction users can view construction documents" ON public.construction_documents;
CREATE POLICY "Construction users can view construction documents"
ON public.construction_documents FOR SELECT
USING (can_access_company(company_id) AND has_construction_access(auth.uid()));

-- construction_inventory_transactions
DROP POLICY IF EXISTS "Authenticated users can view inventory transactions" ON public.construction_inventory_transactions;
DROP POLICY IF EXISTS "Construction users can view inventory transactions" ON public.construction_inventory_transactions;
CREATE POLICY "Construction users can view inventory transactions"
ON public.construction_inventory_transactions FOR SELECT
USING (can_access_company(company_id) AND has_construction_access(auth.uid()));

-- construction_repair_records
DROP POLICY IF EXISTS "Authenticated users can view repair records" ON public.construction_repair_records;
DROP POLICY IF EXISTS "Construction users can view repair records" ON public.construction_repair_records;
CREATE POLICY "Construction users can view repair records"
ON public.construction_repair_records FOR SELECT
USING (can_access_company(company_id) AND has_construction_access(auth.uid()));

-- construction_resources
DROP POLICY IF EXISTS "Authenticated users can view construction resources" ON public.construction_resources;
DROP POLICY IF EXISTS "Construction users can view construction resources" ON public.construction_resources;
CREATE POLICY "Construction users can view construction resources"
ON public.construction_resources FOR SELECT
USING (can_access_company(company_id) AND has_construction_access(auth.uid()));

-- construction_work_orders
DROP POLICY IF EXISTS "Authenticated users can view work orders" ON public.construction_work_orders;
DROP POLICY IF EXISTS "Construction users can view work orders" ON public.construction_work_orders;
CREATE POLICY "Construction users can view work orders"
ON public.construction_work_orders FOR SELECT
USING (can_access_company(company_id) AND has_construction_access(auth.uid()));

-- construction_labour_master (HR sensitive - EPF, contact info)
DROP POLICY IF EXISTS "Authenticated users can view labour master" ON public.construction_labour_master;
DROP POLICY IF EXISTS "HR and construction can view labour master" ON public.construction_labour_master;
CREATE POLICY "HR and construction can view labour master"
ON public.construction_labour_master FOR SELECT
USING (can_access_company(company_id) AND (has_hr_access(auth.uid()) OR has_construction_access(auth.uid())));

-- construction_subcontractor_master
DROP POLICY IF EXISTS "Authenticated users can view subcontractor master" ON public.construction_subcontractor_master;
DROP POLICY IF EXISTS "Construction users can view subcontractor master" ON public.construction_subcontractor_master;
CREATE POLICY "Construction users can view subcontractor master"
ON public.construction_subcontractor_master FOR SELECT
USING (can_access_company(company_id) AND has_construction_access(auth.uid()));

-- ============================================
-- PART 5: Fix Warehouse/Tool Tables
-- ============================================

-- warehouse_tools
DROP POLICY IF EXISTS "Users can view warehouse tools" ON public.warehouse_tools;
DROP POLICY IF EXISTS "Warehouse users can view warehouse tools" ON public.warehouse_tools;
CREATE POLICY "Warehouse users can view warehouse tools"
ON public.warehouse_tools FOR SELECT
USING (can_access_company(company_id) AND has_warehouse_access(auth.uid()));

-- tool_issues
DROP POLICY IF EXISTS "Users can view tool issues" ON public.tool_issues;
DROP POLICY IF EXISTS "Warehouse users can view tool issues" ON public.tool_issues;
CREATE POLICY "Warehouse users can view tool issues"
ON public.tool_issues FOR SELECT
USING (can_access_company(company_id) AND has_warehouse_access(auth.uid()));

-- tool_returns
DROP POLICY IF EXISTS "Users can view tool returns" ON public.tool_returns;
DROP POLICY IF EXISTS "Warehouse users can view tool returns" ON public.tool_returns;
CREATE POLICY "Warehouse users can view tool returns"
ON public.tool_returns FOR SELECT
USING (can_access_company(company_id) AND has_warehouse_access(auth.uid()));

-- ============================================
-- PART 6: Fix Safety Tables (HR Access)
-- ============================================

-- safety_incidents
DROP POLICY IF EXISTS "Users can view safety incidents" ON public.safety_incidents;
DROP POLICY IF EXISTS "HR users can view safety incidents" ON public.safety_incidents;
CREATE POLICY "HR users can view safety incidents"
ON public.safety_incidents FOR SELECT
USING (can_access_company(company_id) AND has_hr_access(auth.uid()));

-- safety_inspections
DROP POLICY IF EXISTS "Users can view safety inspections" ON public.safety_inspections;
DROP POLICY IF EXISTS "HR users can view safety inspections" ON public.safety_inspections;
CREATE POLICY "HR users can view safety inspections"
ON public.safety_inspections FOR SELECT
USING (can_access_company(company_id) AND has_hr_access(auth.uid()));

-- ============================================
-- PART 7: Fix Procurement Tables
-- ============================================

-- supplier_evaluations
DROP POLICY IF EXISTS "Users can view supplier evaluations" ON public.supplier_evaluations;
DROP POLICY IF EXISTS "Procurement users can view supplier evaluations" ON public.supplier_evaluations;
CREATE POLICY "Procurement users can view supplier evaluations"
ON public.supplier_evaluations FOR SELECT
USING (can_access_company(company_id) AND has_procurement_access(auth.uid()));

-- ============================================
-- PART 8: Protect Profiles PII
-- ============================================

-- Profiles - Users see own, admins see company
DROP POLICY IF EXISTS "Users can view own profile or company profiles" ON public.profiles;
DROP POLICY IF EXISTS "Users can view profiles" ON public.profiles;
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
DROP POLICY IF EXISTS "Admins can view company profiles" ON public.profiles;

CREATE POLICY "Users can view own profile"
ON public.profiles FOR SELECT
USING (user_id = auth.uid());

CREATE POLICY "Admins can view company profiles"
ON public.profiles FOR SELECT
USING (is_admin(auth.uid()) AND can_access_company(company_id));

-- ============================================
-- PART 9: SAP Compatibility Enhancements
-- ============================================

-- Add invoice_number to supplier_invoices if not exists
ALTER TABLE public.supplier_invoices 
ADD COLUMN IF NOT EXISTS invoice_number TEXT;

-- Add invoice_number to customer_invoices if not exists
ALTER TABLE public.customer_invoices 
ADD COLUMN IF NOT EXISTS invoice_number TEXT;

-- Create SAP mapping indexes for performance
CREATE INDEX IF NOT EXISTS idx_sap_entity_mappings_lookup 
ON public.sap_entity_mappings(entity_type, local_id);

CREATE INDEX IF NOT EXISTS idx_sap_entity_mappings_sap_code 
ON public.sap_entity_mappings(entity_type, sap_code, company_id);

-- Create index on sync_status for filtering pending syncs
CREATE INDEX IF NOT EXISTS idx_sap_entity_mappings_status 
ON public.sap_entity_mappings(sync_status) WHERE sync_status = 'pending';