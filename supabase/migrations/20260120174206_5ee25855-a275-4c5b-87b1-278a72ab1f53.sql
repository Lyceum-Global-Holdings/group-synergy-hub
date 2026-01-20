-- =====================================================
-- SECURITY HARDENING MIGRATION - Complete Fix
-- =====================================================

-- =====================================================
-- PHASE 1: Create Role-Based Access Helper Functions
-- =====================================================

-- Finance access check function
CREATE OR REPLACE FUNCTION public.has_finance_access(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles ur
    JOIN public.roles r ON ur.role_id = r.id
    WHERE ur.user_id = _user_id
    AND (r.app_role IN ('admin', 'super_admin') 
         OR r.department = 'Finance'
         OR r.name ILIKE '%finance%'
         OR r.name ILIKE '%accountant%')
  ) OR public.is_admin(_user_id);
$$;

-- Procurement access check function
CREATE OR REPLACE FUNCTION public.has_procurement_access(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles ur
    JOIN public.roles r ON ur.role_id = r.id
    WHERE ur.user_id = _user_id
    AND (r.app_role IN ('admin', 'super_admin') 
         OR r.department = 'Procurement'
         OR r.name ILIKE '%procurement%'
         OR r.name ILIKE '%purchasing%')
  ) OR public.is_admin(_user_id);
$$;

-- Construction access check function
CREATE OR REPLACE FUNCTION public.has_construction_access(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles ur
    JOIN public.roles r ON ur.role_id = r.id
    WHERE ur.user_id = _user_id
    AND (r.app_role IN ('admin', 'super_admin') 
         OR r.department = 'Construction'
         OR r.name ILIKE '%construction%'
         OR r.name ILIKE '%project%')
  ) OR public.is_admin(_user_id);
$$;

-- =====================================================
-- PHASE 2: Fix Function Search Path Vulnerability
-- =====================================================

CREATE OR REPLACE FUNCTION public.update_stock_on_grn_approval()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  IF NEW.status = 'approved' AND (OLD.status IS NULL OR OLD.status <> 'approved') THEN
    UPDATE warehouse_items wi
    SET 
      quantity_in_stock = COALESCE(wi.quantity_in_stock, 0) + COALESCE(gi.received_quantity, 0),
      updated_at = now()
    FROM grn_items gi
    WHERE gi.grn_id = NEW.id
    AND wi.id = gi.warehouse_item_id;
  END IF;
  RETURN NEW;
END;
$function$;

-- =====================================================
-- PHASE 3: Fix Bank Accounts Policies
-- =====================================================

DROP POLICY IF EXISTS "Users can create bank accounts" ON public.bank_accounts;
DROP POLICY IF EXISTS "Users can update bank accounts" ON public.bank_accounts;
DROP POLICY IF EXISTS "Users can delete bank accounts" ON public.bank_accounts;
DROP POLICY IF EXISTS "Users can create bank accounts for their company" ON public.bank_accounts;
DROP POLICY IF EXISTS "Users can update their company bank accounts" ON public.bank_accounts;
DROP POLICY IF EXISTS "Admins can delete bank accounts" ON public.bank_accounts;

CREATE POLICY "Finance users can create bank accounts"
ON public.bank_accounts FOR INSERT
WITH CHECK (public.can_access_company(company_id) AND public.has_finance_access(auth.uid()));

CREATE POLICY "Finance users can update bank accounts"
ON public.bank_accounts FOR UPDATE
USING (public.can_access_company(company_id) AND public.has_finance_access(auth.uid()));

CREATE POLICY "Only admins can delete bank accounts"
ON public.bank_accounts FOR DELETE
USING (public.is_admin(auth.uid()) AND public.can_access_company(company_id));

-- =====================================================
-- PHASE 4: Fix Bank Transactions Policies
-- =====================================================

DROP POLICY IF EXISTS "Users can create bank transactions" ON public.bank_transactions;
DROP POLICY IF EXISTS "Users can update bank transactions" ON public.bank_transactions;
DROP POLICY IF EXISTS "Users can delete bank transactions" ON public.bank_transactions;
DROP POLICY IF EXISTS "Users can create bank transactions for their company" ON public.bank_transactions;
DROP POLICY IF EXISTS "Users can update their company bank transactions" ON public.bank_transactions;
DROP POLICY IF EXISTS "Admins can delete bank transactions" ON public.bank_transactions;

CREATE POLICY "Finance users can create bank transactions"
ON public.bank_transactions FOR INSERT
WITH CHECK (public.can_access_company(company_id) AND public.has_finance_access(auth.uid()));

CREATE POLICY "Finance users can update bank transactions"
ON public.bank_transactions FOR UPDATE
USING (public.can_access_company(company_id) AND public.has_finance_access(auth.uid()));

CREATE POLICY "Only admins can delete bank transactions"
ON public.bank_transactions FOR DELETE
USING (public.is_admin(auth.uid()) AND public.can_access_company(company_id));

-- =====================================================
-- PHASE 5: Fix Bank Statements Policies
-- =====================================================

DROP POLICY IF EXISTS "Users can create bank statements" ON public.bank_statements;
DROP POLICY IF EXISTS "Users can update bank statements" ON public.bank_statements;
DROP POLICY IF EXISTS "Users can delete bank statements" ON public.bank_statements;
DROP POLICY IF EXISTS "Users can create bank statements for their company" ON public.bank_statements;
DROP POLICY IF EXISTS "Users can update their company bank statements" ON public.bank_statements;
DROP POLICY IF EXISTS "Admins can delete bank statements" ON public.bank_statements;

CREATE POLICY "Finance users can create bank statements"
ON public.bank_statements FOR INSERT
WITH CHECK (public.can_access_company(company_id) AND public.has_finance_access(auth.uid()));

CREATE POLICY "Finance users can update bank statements"
ON public.bank_statements FOR UPDATE
USING (public.can_access_company(company_id) AND public.has_finance_access(auth.uid()));

CREATE POLICY "Only admins can delete bank statements"
ON public.bank_statements FOR DELETE
USING (public.is_admin(auth.uid()) AND public.can_access_company(company_id));

-- =====================================================
-- PHASE 6: Fix Bank Reconciliations Policies
-- =====================================================

DROP POLICY IF EXISTS "Users can create bank reconciliations" ON public.bank_reconciliations;
DROP POLICY IF EXISTS "Users can update bank reconciliations" ON public.bank_reconciliations;
DROP POLICY IF EXISTS "Users can delete bank reconciliations" ON public.bank_reconciliations;
DROP POLICY IF EXISTS "Users can create bank reconciliations for their company" ON public.bank_reconciliations;
DROP POLICY IF EXISTS "Users can update their company bank reconciliations" ON public.bank_reconciliations;
DROP POLICY IF EXISTS "Admins can delete bank reconciliations" ON public.bank_reconciliations;

CREATE POLICY "Finance users can create bank reconciliations"
ON public.bank_reconciliations FOR INSERT
WITH CHECK (public.can_access_company(company_id) AND public.has_finance_access(auth.uid()));

CREATE POLICY "Finance users can update bank reconciliations"
ON public.bank_reconciliations FOR UPDATE
USING (public.can_access_company(company_id) AND public.has_finance_access(auth.uid()));

CREATE POLICY "Only admins can delete bank reconciliations"
ON public.bank_reconciliations FOR DELETE
USING (public.is_admin(auth.uid()) AND public.can_access_company(company_id));

-- =====================================================
-- PHASE 7: Fix Budget Lines Policies
-- =====================================================

DROP POLICY IF EXISTS "Users can create budget lines" ON public.budget_lines;
DROP POLICY IF EXISTS "Users can update budget lines" ON public.budget_lines;
DROP POLICY IF EXISTS "Users can delete budget lines" ON public.budget_lines;
DROP POLICY IF EXISTS "Finance users can create budget lines" ON public.budget_lines;
DROP POLICY IF EXISTS "Finance users can update budget lines" ON public.budget_lines;
DROP POLICY IF EXISTS "Admins can delete budget lines" ON public.budget_lines;

CREATE POLICY "Finance users can insert budget lines"
ON public.budget_lines FOR INSERT
WITH CHECK (public.has_finance_access(auth.uid()));

CREATE POLICY "Finance users can modify budget lines"
ON public.budget_lines FOR UPDATE
USING (public.has_finance_access(auth.uid()));

CREATE POLICY "Only admins can delete budget lines"
ON public.budget_lines FOR DELETE
USING (public.is_admin(auth.uid()));

-- =====================================================
-- PHASE 8: Fix Budgets Policies
-- =====================================================

DROP POLICY IF EXISTS "Users can create budgets" ON public.budgets;
DROP POLICY IF EXISTS "Users can update budgets" ON public.budgets;
DROP POLICY IF EXISTS "Users can delete budgets" ON public.budgets;
DROP POLICY IF EXISTS "Finance users can create budgets for their company" ON public.budgets;
DROP POLICY IF EXISTS "Finance users can update their company budgets" ON public.budgets;
DROP POLICY IF EXISTS "Admins can delete budgets" ON public.budgets;

CREATE POLICY "Finance users can create budgets"
ON public.budgets FOR INSERT
WITH CHECK (public.can_access_company(company_id) AND public.has_finance_access(auth.uid()));

CREATE POLICY "Finance users can update budgets"
ON public.budgets FOR UPDATE
USING (public.can_access_company(company_id) AND public.has_finance_access(auth.uid()));

CREATE POLICY "Only admins can delete budgets"
ON public.budgets FOR DELETE
USING (public.is_admin(auth.uid()) AND public.can_access_company(company_id));

-- =====================================================
-- PHASE 9: Fix Supplier Invoices Policies
-- =====================================================

DROP POLICY IF EXISTS "Users can create supplier invoices" ON public.supplier_invoices;
DROP POLICY IF EXISTS "Users can update supplier invoices" ON public.supplier_invoices;
DROP POLICY IF EXISTS "Users can delete supplier invoices" ON public.supplier_invoices;
DROP POLICY IF EXISTS "Finance/Procurement users can create supplier invoices" ON public.supplier_invoices;
DROP POLICY IF EXISTS "Finance/Procurement users can update supplier invoices" ON public.supplier_invoices;
DROP POLICY IF EXISTS "Admins can delete supplier invoices" ON public.supplier_invoices;

CREATE POLICY "Finance or Procurement users can create supplier invoices"
ON public.supplier_invoices FOR INSERT
WITH CHECK (public.can_access_company(company_id) AND (public.has_finance_access(auth.uid()) OR public.has_procurement_access(auth.uid())));

CREATE POLICY "Finance or Procurement users can update supplier invoices"
ON public.supplier_invoices FOR UPDATE
USING (public.can_access_company(company_id) AND (public.has_finance_access(auth.uid()) OR public.has_procurement_access(auth.uid())));

CREATE POLICY "Only admins can delete supplier invoices"
ON public.supplier_invoices FOR DELETE
USING (public.is_admin(auth.uid()) AND public.can_access_company(company_id));

-- =====================================================
-- PHASE 10: Fix Supplier Invoice Lines Policies
-- =====================================================

DROP POLICY IF EXISTS "Users can create supplier invoice lines" ON public.supplier_invoice_lines;
DROP POLICY IF EXISTS "Users can update supplier invoice lines" ON public.supplier_invoice_lines;
DROP POLICY IF EXISTS "Users can delete supplier invoice lines" ON public.supplier_invoice_lines;
DROP POLICY IF EXISTS "Finance/Procurement users can create supplier invoice lines" ON public.supplier_invoice_lines;
DROP POLICY IF EXISTS "Finance/Procurement users can update supplier invoice lines" ON public.supplier_invoice_lines;
DROP POLICY IF EXISTS "Admins can delete supplier invoice lines" ON public.supplier_invoice_lines;

CREATE POLICY "Finance or Procurement can create supplier invoice lines"
ON public.supplier_invoice_lines FOR INSERT
WITH CHECK (public.has_finance_access(auth.uid()) OR public.has_procurement_access(auth.uid()));

CREATE POLICY "Finance or Procurement can update supplier invoice lines"
ON public.supplier_invoice_lines FOR UPDATE
USING (public.has_finance_access(auth.uid()) OR public.has_procurement_access(auth.uid()));

CREATE POLICY "Only admins can delete supplier invoice lines"
ON public.supplier_invoice_lines FOR DELETE
USING (public.is_admin(auth.uid()));

-- =====================================================
-- PHASE 11: Fix Supplier Payments Policies
-- =====================================================

DROP POLICY IF EXISTS "Users can create supplier payments" ON public.supplier_payments;
DROP POLICY IF EXISTS "Users can update supplier payments" ON public.supplier_payments;
DROP POLICY IF EXISTS "Users can delete supplier payments" ON public.supplier_payments;
DROP POLICY IF EXISTS "Finance users can create supplier payments" ON public.supplier_payments;
DROP POLICY IF EXISTS "Finance users can update supplier payments" ON public.supplier_payments;
DROP POLICY IF EXISTS "Admins can delete supplier payments" ON public.supplier_payments;

CREATE POLICY "Finance users can create supplier payments"
ON public.supplier_payments FOR INSERT
WITH CHECK (public.can_access_company(company_id) AND public.has_finance_access(auth.uid()));

CREATE POLICY "Finance users can update supplier payments"
ON public.supplier_payments FOR UPDATE
USING (public.can_access_company(company_id) AND public.has_finance_access(auth.uid()));

CREATE POLICY "Only admins can delete supplier payments"
ON public.supplier_payments FOR DELETE
USING (public.is_admin(auth.uid()) AND public.can_access_company(company_id));

-- =====================================================
-- PHASE 12: Fix Customer Invoices Policies
-- =====================================================

DROP POLICY IF EXISTS "Users can create customer invoices" ON public.customer_invoices;
DROP POLICY IF EXISTS "Users can update customer invoices" ON public.customer_invoices;
DROP POLICY IF EXISTS "Users can delete customer invoices" ON public.customer_invoices;
DROP POLICY IF EXISTS "Finance users can create customer invoices" ON public.customer_invoices;
DROP POLICY IF EXISTS "Finance users can update customer invoices" ON public.customer_invoices;
DROP POLICY IF EXISTS "Admins can delete customer invoices" ON public.customer_invoices;

CREATE POLICY "Finance users can create customer invoices"
ON public.customer_invoices FOR INSERT
WITH CHECK (public.can_access_company(company_id) AND public.has_finance_access(auth.uid()));

CREATE POLICY "Finance users can update customer invoices"
ON public.customer_invoices FOR UPDATE
USING (public.can_access_company(company_id) AND public.has_finance_access(auth.uid()));

CREATE POLICY "Only admins can delete customer invoices"
ON public.customer_invoices FOR DELETE
USING (public.is_admin(auth.uid()) AND public.can_access_company(company_id));

-- =====================================================
-- PHASE 13: Fix Customer Invoice Lines Policies
-- =====================================================

DROP POLICY IF EXISTS "Users can create customer invoice lines" ON public.customer_invoice_lines;
DROP POLICY IF EXISTS "Users can update customer invoice lines" ON public.customer_invoice_lines;
DROP POLICY IF EXISTS "Users can delete customer invoice lines" ON public.customer_invoice_lines;
DROP POLICY IF EXISTS "Finance users can create customer invoice lines" ON public.customer_invoice_lines;
DROP POLICY IF EXISTS "Finance users can update customer invoice lines" ON public.customer_invoice_lines;
DROP POLICY IF EXISTS "Admins can delete customer invoice lines" ON public.customer_invoice_lines;

CREATE POLICY "Finance users can insert customer invoice lines"
ON public.customer_invoice_lines FOR INSERT
WITH CHECK (public.has_finance_access(auth.uid()));

CREATE POLICY "Finance users can modify customer invoice lines"
ON public.customer_invoice_lines FOR UPDATE
USING (public.has_finance_access(auth.uid()));

CREATE POLICY "Only admins can delete customer invoice lines"
ON public.customer_invoice_lines FOR DELETE
USING (public.is_admin(auth.uid()));

-- =====================================================
-- PHASE 14: Fix Customer Receipts Policies
-- =====================================================

DROP POLICY IF EXISTS "Users can create customer receipts" ON public.customer_receipts;
DROP POLICY IF EXISTS "Users can update customer receipts" ON public.customer_receipts;
DROP POLICY IF EXISTS "Users can delete customer receipts" ON public.customer_receipts;
DROP POLICY IF EXISTS "Finance users can create customer receipts" ON public.customer_receipts;
DROP POLICY IF EXISTS "Finance users can update customer receipts" ON public.customer_receipts;
DROP POLICY IF EXISTS "Admins can delete customer receipts" ON public.customer_receipts;

CREATE POLICY "Finance users can create customer receipts"
ON public.customer_receipts FOR INSERT
WITH CHECK (public.can_access_company(company_id) AND public.has_finance_access(auth.uid()));

CREATE POLICY "Finance users can update customer receipts"
ON public.customer_receipts FOR UPDATE
USING (public.can_access_company(company_id) AND public.has_finance_access(auth.uid()));

CREATE POLICY "Only admins can delete customer receipts"
ON public.customer_receipts FOR DELETE
USING (public.is_admin(auth.uid()) AND public.can_access_company(company_id));

-- =====================================================
-- PHASE 15: Fix Payment Allocations Policies
-- =====================================================

DROP POLICY IF EXISTS "Users can create payment allocations" ON public.payment_allocations;
DROP POLICY IF EXISTS "Users can update payment allocations" ON public.payment_allocations;
DROP POLICY IF EXISTS "Users can delete payment allocations" ON public.payment_allocations;
DROP POLICY IF EXISTS "Finance users can create payment allocations" ON public.payment_allocations;
DROP POLICY IF EXISTS "Finance users can update payment allocations" ON public.payment_allocations;
DROP POLICY IF EXISTS "Admins can delete payment allocations" ON public.payment_allocations;

CREATE POLICY "Finance users can insert payment allocations"
ON public.payment_allocations FOR INSERT
WITH CHECK (public.has_finance_access(auth.uid()));

CREATE POLICY "Finance users can modify payment allocations"
ON public.payment_allocations FOR UPDATE
USING (public.has_finance_access(auth.uid()));

CREATE POLICY "Only admins can delete payment allocations"
ON public.payment_allocations FOR DELETE
USING (public.is_admin(auth.uid()));

-- =====================================================
-- PHASE 16: Fix Receipt Allocations Policies
-- =====================================================

DROP POLICY IF EXISTS "Users can create receipt allocations" ON public.receipt_allocations;
DROP POLICY IF EXISTS "Users can update receipt allocations" ON public.receipt_allocations;
DROP POLICY IF EXISTS "Users can delete receipt allocations" ON public.receipt_allocations;
DROP POLICY IF EXISTS "Finance users can create receipt allocations" ON public.receipt_allocations;
DROP POLICY IF EXISTS "Finance users can update receipt allocations" ON public.receipt_allocations;
DROP POLICY IF EXISTS "Admins can delete receipt allocations" ON public.receipt_allocations;

CREATE POLICY "Finance users can insert receipt allocations"
ON public.receipt_allocations FOR INSERT
WITH CHECK (public.has_finance_access(auth.uid()));

CREATE POLICY "Finance users can modify receipt allocations"
ON public.receipt_allocations FOR UPDATE
USING (public.has_finance_access(auth.uid()));

CREATE POLICY "Only admins can delete receipt allocations"
ON public.receipt_allocations FOR DELETE
USING (public.is_admin(auth.uid()));

-- =====================================================
-- PHASE 17: Fix Depreciation Schedule Policies
-- =====================================================

DROP POLICY IF EXISTS "Users can create depreciation schedules" ON public.depreciation_schedule;
DROP POLICY IF EXISTS "Users can update depreciation schedules" ON public.depreciation_schedule;
DROP POLICY IF EXISTS "Users can delete depreciation schedules" ON public.depreciation_schedule;
DROP POLICY IF EXISTS "Finance users can create depreciation schedules" ON public.depreciation_schedule;
DROP POLICY IF EXISTS "Finance users can update depreciation schedules" ON public.depreciation_schedule;
DROP POLICY IF EXISTS "Admins can delete depreciation schedules" ON public.depreciation_schedule;

CREATE POLICY "Finance users can create depreciation entries"
ON public.depreciation_schedule FOR INSERT
WITH CHECK (public.can_access_company(company_id) AND public.has_finance_access(auth.uid()));

CREATE POLICY "Finance users can update depreciation entries"
ON public.depreciation_schedule FOR UPDATE
USING (public.can_access_company(company_id) AND public.has_finance_access(auth.uid()));

CREATE POLICY "Only admins can delete depreciation entries"
ON public.depreciation_schedule FOR DELETE
USING (public.is_admin(auth.uid()) AND public.can_access_company(company_id));

-- =====================================================
-- PHASE 18: Fix Profit Centers Policies
-- =====================================================

DROP POLICY IF EXISTS "Users can create profit centers" ON public.profit_centers;
DROP POLICY IF EXISTS "Users can update profit centers" ON public.profit_centers;
DROP POLICY IF EXISTS "Users can delete profit centers" ON public.profit_centers;
DROP POLICY IF EXISTS "Finance users can create profit centers" ON public.profit_centers;
DROP POLICY IF EXISTS "Finance users can update profit centers" ON public.profit_centers;
DROP POLICY IF EXISTS "Admins can delete profit centers" ON public.profit_centers;

CREATE POLICY "Finance users can create profit centers"
ON public.profit_centers FOR INSERT
WITH CHECK (public.can_access_company(company_id) AND public.has_finance_access(auth.uid()));

CREATE POLICY "Finance users can update profit centers"
ON public.profit_centers FOR UPDATE
USING (public.can_access_company(company_id) AND public.has_finance_access(auth.uid()));

CREATE POLICY "Only admins can delete profit centers"
ON public.profit_centers FOR DELETE
USING (public.is_admin(auth.uid()) AND public.can_access_company(company_id));

-- =====================================================
-- PHASE 19: Fix Construction Inventory Master Policies
-- =====================================================

DROP POLICY IF EXISTS "Users can create construction inventory" ON public.construction_inventory_master;
DROP POLICY IF EXISTS "Users can update construction inventory" ON public.construction_inventory_master;
DROP POLICY IF EXISTS "Users can delete construction inventory" ON public.construction_inventory_master;
DROP POLICY IF EXISTS "Construction users can create inventory" ON public.construction_inventory_master;
DROP POLICY IF EXISTS "Construction users can update inventory" ON public.construction_inventory_master;
DROP POLICY IF EXISTS "Admins can delete construction inventory" ON public.construction_inventory_master;

CREATE POLICY "Construction users can insert inventory"
ON public.construction_inventory_master FOR INSERT
WITH CHECK (public.can_access_company(company_id) AND public.has_construction_access(auth.uid()));

CREATE POLICY "Construction users can modify inventory"
ON public.construction_inventory_master FOR UPDATE
USING (public.can_access_company(company_id) AND public.has_construction_access(auth.uid()));

CREATE POLICY "Only admins can delete construction inventory"
ON public.construction_inventory_master FOR DELETE
USING (public.is_admin(auth.uid()) AND public.can_access_company(company_id));

-- =====================================================
-- PHASE 20: Fix Construction Inventory Transactions Policies
-- =====================================================

DROP POLICY IF EXISTS "Users can create inventory transactions" ON public.construction_inventory_transactions;
DROP POLICY IF EXISTS "Users can update inventory transactions" ON public.construction_inventory_transactions;
DROP POLICY IF EXISTS "Users can delete inventory transactions" ON public.construction_inventory_transactions;
DROP POLICY IF EXISTS "Construction users can create inventory transactions" ON public.construction_inventory_transactions;
DROP POLICY IF EXISTS "Construction users can update inventory transactions" ON public.construction_inventory_transactions;
DROP POLICY IF EXISTS "Admins can delete inventory transactions" ON public.construction_inventory_transactions;

CREATE POLICY "Construction users can insert inventory transactions"
ON public.construction_inventory_transactions FOR INSERT
WITH CHECK (public.can_access_company(company_id) AND public.has_construction_access(auth.uid()));

CREATE POLICY "Construction users can modify inventory transactions"
ON public.construction_inventory_transactions FOR UPDATE
USING (public.can_access_company(company_id) AND public.has_construction_access(auth.uid()));

CREATE POLICY "Only admins can delete inventory transactions"
ON public.construction_inventory_transactions FOR DELETE
USING (public.is_admin(auth.uid()) AND public.can_access_company(company_id));

-- =====================================================
-- PHASE 21: Fix Construction Labour Master Policies
-- =====================================================

DROP POLICY IF EXISTS "Users can create labour records" ON public.construction_labour_master;
DROP POLICY IF EXISTS "Users can update labour records" ON public.construction_labour_master;
DROP POLICY IF EXISTS "Users can delete labour records" ON public.construction_labour_master;
DROP POLICY IF EXISTS "Construction users can create labour records" ON public.construction_labour_master;
DROP POLICY IF EXISTS "Construction users can update labour records" ON public.construction_labour_master;
DROP POLICY IF EXISTS "Admins can delete labour records" ON public.construction_labour_master;

CREATE POLICY "Construction users can insert labour records"
ON public.construction_labour_master FOR INSERT
WITH CHECK (public.can_access_company(company_id) AND public.has_construction_access(auth.uid()));

CREATE POLICY "Construction users can modify labour records"
ON public.construction_labour_master FOR UPDATE
USING (public.can_access_company(company_id) AND public.has_construction_access(auth.uid()));

CREATE POLICY "Only admins can delete labour records"
ON public.construction_labour_master FOR DELETE
USING (public.is_admin(auth.uid()) AND public.can_access_company(company_id));

-- =====================================================
-- PHASE 22: Fix Construction Repair Records Policies
-- =====================================================

DROP POLICY IF EXISTS "Users can create repair records" ON public.construction_repair_records;
DROP POLICY IF EXISTS "Users can update repair records" ON public.construction_repair_records;
DROP POLICY IF EXISTS "Users can delete repair records" ON public.construction_repair_records;
DROP POLICY IF EXISTS "Construction users can create repair records" ON public.construction_repair_records;
DROP POLICY IF EXISTS "Construction users can update repair records" ON public.construction_repair_records;
DROP POLICY IF EXISTS "Admins can delete repair records" ON public.construction_repair_records;

CREATE POLICY "Construction users can insert repair records"
ON public.construction_repair_records FOR INSERT
WITH CHECK (public.can_access_company(company_id) AND public.has_construction_access(auth.uid()));

CREATE POLICY "Construction users can modify repair records"
ON public.construction_repair_records FOR UPDATE
USING (public.can_access_company(company_id) AND public.has_construction_access(auth.uid()));

CREATE POLICY "Only admins can delete repair records"
ON public.construction_repair_records FOR DELETE
USING (public.is_admin(auth.uid()) AND public.can_access_company(company_id));

-- =====================================================
-- PHASE 23: Fix Construction Subcontractor Master Policies
-- =====================================================

DROP POLICY IF EXISTS "Users can create subcontractors" ON public.construction_subcontractor_master;
DROP POLICY IF EXISTS "Users can update subcontractors" ON public.construction_subcontractor_master;
DROP POLICY IF EXISTS "Users can delete subcontractors" ON public.construction_subcontractor_master;
DROP POLICY IF EXISTS "Construction users can create subcontractors" ON public.construction_subcontractor_master;
DROP POLICY IF EXISTS "Construction users can update subcontractors" ON public.construction_subcontractor_master;
DROP POLICY IF EXISTS "Admins can delete subcontractors" ON public.construction_subcontractor_master;

CREATE POLICY "Construction users can insert subcontractors"
ON public.construction_subcontractor_master FOR INSERT
WITH CHECK (public.can_access_company(company_id) AND public.has_construction_access(auth.uid()));

CREATE POLICY "Construction users can modify subcontractors"
ON public.construction_subcontractor_master FOR UPDATE
USING (public.can_access_company(company_id) AND public.has_construction_access(auth.uid()));

CREATE POLICY "Only admins can delete subcontractors"
ON public.construction_subcontractor_master FOR DELETE
USING (public.is_admin(auth.uid()) AND public.can_access_company(company_id));

-- =====================================================
-- PHASE 24: Fix Asset Transactions Policies
-- =====================================================

DROP POLICY IF EXISTS "Users can create asset transactions" ON public.asset_transactions;
DROP POLICY IF EXISTS "Users can update asset transactions" ON public.asset_transactions;
DROP POLICY IF EXISTS "Users can delete asset transactions" ON public.asset_transactions;
DROP POLICY IF EXISTS "Finance users can create asset transactions" ON public.asset_transactions;
DROP POLICY IF EXISTS "Finance users can update asset transactions" ON public.asset_transactions;
DROP POLICY IF EXISTS "Admins can delete asset transactions" ON public.asset_transactions;

CREATE POLICY "Finance users can insert asset transactions"
ON public.asset_transactions FOR INSERT
WITH CHECK (public.can_access_company(company_id) AND public.has_finance_access(auth.uid()));

CREATE POLICY "Finance users can modify asset transactions"
ON public.asset_transactions FOR UPDATE
USING (public.can_access_company(company_id) AND public.has_finance_access(auth.uid()));

CREATE POLICY "Only admins can delete asset transactions"
ON public.asset_transactions FOR DELETE
USING (public.is_admin(auth.uid()) AND public.can_access_company(company_id));

-- =====================================================
-- PHASE 25: Fix Customers Policies
-- =====================================================

DROP POLICY IF EXISTS "Users can create customers" ON public.customers;
DROP POLICY IF EXISTS "Users can update customers" ON public.customers;
DROP POLICY IF EXISTS "Users can delete customers" ON public.customers;
DROP POLICY IF EXISTS "Admins can delete customers" ON public.customers;
DROP POLICY IF EXISTS "Users can create customers for their company" ON public.customers;
DROP POLICY IF EXISTS "Users can update their company customers" ON public.customers;
DROP POLICY IF EXISTS "Only admins can delete customers" ON public.customers;

CREATE POLICY "Company users can create customers"
ON public.customers FOR INSERT
WITH CHECK (public.can_access_company(company_id));

CREATE POLICY "Company users can update customers"
ON public.customers FOR UPDATE
USING (public.can_access_company(company_id));

CREATE POLICY "Admins only can delete customers"
ON public.customers FOR DELETE
USING (public.is_admin(auth.uid()) AND public.can_access_company(company_id));

-- =====================================================
-- PHASE 26: Fix Supplier Contacts Policies
-- =====================================================

DROP POLICY IF EXISTS "Users can create supplier contacts" ON public.supplier_contacts;
DROP POLICY IF EXISTS "Users can update supplier contacts" ON public.supplier_contacts;
DROP POLICY IF EXISTS "Users can delete supplier contacts" ON public.supplier_contacts;
DROP POLICY IF EXISTS "Admins can delete supplier contacts" ON public.supplier_contacts;
DROP POLICY IF EXISTS "Procurement users can create supplier contacts" ON public.supplier_contacts;
DROP POLICY IF EXISTS "Procurement users can update supplier contacts" ON public.supplier_contacts;
DROP POLICY IF EXISTS "Only admins can delete supplier contacts" ON public.supplier_contacts;

CREATE POLICY "Procurement users can insert supplier contacts"
ON public.supplier_contacts FOR INSERT
WITH CHECK (public.has_procurement_access(auth.uid()));

CREATE POLICY "Procurement users can modify supplier contacts"
ON public.supplier_contacts FOR UPDATE
USING (public.has_procurement_access(auth.uid()));

CREATE POLICY "Admins only can delete supplier contacts"
ON public.supplier_contacts FOR DELETE
USING (public.is_admin(auth.uid()));