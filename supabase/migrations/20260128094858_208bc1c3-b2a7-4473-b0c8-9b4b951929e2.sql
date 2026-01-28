-- =====================================================
-- SECURITY FIX: RLS Policy Hardening (Retry)
-- Drop existing policies first, then recreate with proper restrictions
-- =====================================================

-- ===========================================
-- 5. FIX: Customers Access Control (Existing policy conflict)
-- ===========================================

DROP POLICY IF EXISTS "Sales and finance can view customers" ON customers;
DROP POLICY IF EXISTS "Authenticated users can view customers" ON customers;
DROP POLICY IF EXISTS "Users can view customers" ON customers;
DROP POLICY IF EXISTS "Company users can view customers" ON customers;

CREATE POLICY "Sales and finance can view customers"
ON customers FOR SELECT
USING (
  is_super_admin(auth.uid()) OR
  (can_access_company(company_id) AND 
   (has_sales_access(auth.uid()) OR 
    has_finance_access(auth.uid()) OR
    has_manager_access(auth.uid()) OR
    is_admin(auth.uid())))
);

-- ===========================================
-- 6. FIX: Bank Accounts Access Control
-- ===========================================

DROP POLICY IF EXISTS "Finance personnel can view bank accounts" ON bank_accounts;
DROP POLICY IF EXISTS "Authenticated users can view bank accounts" ON bank_accounts;
DROP POLICY IF EXISTS "Users can view bank accounts" ON bank_accounts;
DROP POLICY IF EXISTS "Company users can view bank accounts" ON bank_accounts;

CREATE POLICY "Finance personnel can view bank accounts"
ON bank_accounts FOR SELECT
USING (
  is_super_admin(auth.uid()) OR
  (can_access_company(company_id) AND 
   (has_finance_access(auth.uid()) OR
    is_admin(auth.uid())))
);

-- ===========================================
-- 7. FIX: Supplier Invoices Access Control
-- ===========================================

DROP POLICY IF EXISTS "Finance and procurement can view invoices" ON supplier_invoices;
DROP POLICY IF EXISTS "Authenticated users can view supplier invoices" ON supplier_invoices;
DROP POLICY IF EXISTS "Users can view supplier invoices" ON supplier_invoices;
DROP POLICY IF EXISTS "Company users can view supplier invoices" ON supplier_invoices;

CREATE POLICY "Finance and procurement can view invoices"
ON supplier_invoices FOR SELECT
USING (
  is_super_admin(auth.uid()) OR
  (can_access_company(company_id) AND 
   (has_finance_access(auth.uid()) OR 
    has_procurement_access(auth.uid()) OR
    has_manager_access(auth.uid()) OR
    is_admin(auth.uid())))
);

-- ===========================================
-- 8. FIX: Construction Labour Master Access Control
-- ===========================================

DROP POLICY IF EXISTS "HR and managers can view labour rates" ON construction_labour_master;
DROP POLICY IF EXISTS "Authenticated users can view construction labour" ON construction_labour_master;
DROP POLICY IF EXISTS "Users can view construction labour master" ON construction_labour_master;
DROP POLICY IF EXISTS "Company users can view labour master" ON construction_labour_master;

CREATE POLICY "HR and managers can view labour rates"
ON construction_labour_master FOR SELECT
USING (
  is_super_admin(auth.uid()) OR
  (can_access_company(company_id) AND 
   (has_hr_access(auth.uid()) OR 
    has_construction_access(auth.uid()) OR
    has_manager_access(auth.uid()) OR
    is_admin(auth.uid())))
);

-- ===========================================
-- 9. FIX: Asset Master Access Control
-- ===========================================

DROP POLICY IF EXISTS "Finance and asset managers can view assets" ON asset_master;
DROP POLICY IF EXISTS "Authenticated users can view asset master" ON asset_master;
DROP POLICY IF EXISTS "Users can view asset master" ON asset_master;
DROP POLICY IF EXISTS "Company users can view asset master" ON asset_master;

CREATE POLICY "Finance and asset managers can view assets"
ON asset_master FOR SELECT
USING (
  is_super_admin(auth.uid()) OR
  (can_access_company(company_id) AND 
   (has_finance_access(auth.uid()) OR 
    has_warehouse_access(auth.uid()) OR
    has_manager_access(auth.uid()) OR
    is_admin(auth.uid())))
);

-- ===========================================
-- 10. FIX: Purchase Orders Access Control
-- ===========================================

DROP POLICY IF EXISTS "Procurement and finance can view POs" ON purchase_orders;
DROP POLICY IF EXISTS "Authenticated users can view purchase orders" ON purchase_orders;
DROP POLICY IF EXISTS "Users can view purchase orders" ON purchase_orders;
DROP POLICY IF EXISTS "Company users can view purchase orders" ON purchase_orders;

CREATE POLICY "Procurement and finance can view POs"
ON purchase_orders FOR SELECT
USING (
  is_super_admin(auth.uid()) OR
  (can_access_company(company_id) AND 
   (has_procurement_access(auth.uid()) OR 
    has_finance_access(auth.uid()) OR
    has_warehouse_access(auth.uid()) OR
    has_manager_access(auth.uid()) OR
    is_admin(auth.uid()) OR
    -- Creator can view their own PO
    created_by = auth.uid() OR
    -- Approvers can view POs assigned to them
    merchandiser_approved_by = auth.uid() OR
    department_head_approved_by = auth.uid() OR
    approved_by = auth.uid()))
);