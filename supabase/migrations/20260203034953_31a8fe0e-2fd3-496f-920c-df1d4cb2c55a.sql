-- ============================================
-- SECURITY HARDENING MIGRATION - CASCADE Version
-- ============================================

-- Drop existing functions with CASCADE to remove dependent policies
DROP FUNCTION IF EXISTS has_senior_finance_access(uuid) CASCADE;
DROP FUNCTION IF EXISTS has_manager_access(uuid) CASCADE;
DROP FUNCTION IF EXISTS has_sales_access(uuid) CASCADE;
DROP FUNCTION IF EXISTS has_construction_access(uuid) CASCADE;
DROP FUNCTION IF EXISTS has_hr_access(uuid) CASCADE;
DROP FUNCTION IF EXISTS has_warehouse_access(uuid) CASCADE;
DROP FUNCTION IF EXISTS has_procurement_access(uuid) CASCADE;
DROP FUNCTION IF EXISTS has_finance_access(uuid) CASCADE;
DROP FUNCTION IF EXISTS has_module_access(uuid, text) CASCADE;

-- 1. Create helper function to check module access
CREATE OR REPLACE FUNCTION has_module_access(_user_id uuid, _module_key text)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    is_admin(_user_id)
    OR
    EXISTS (
      SELECT 1 FROM user_modules um
      WHERE um.user_id = _user_id 
      AND um.module_key = _module_key 
      AND um.access_type = 'grant'
    )
    OR
    (
      EXISTS (
        SELECT 1 FROM user_roles ur
        JOIN role_modules rm ON ur.role_id = rm.role_id
        WHERE ur.user_id = _user_id AND rm.module_key = _module_key
      )
      AND NOT EXISTS (
        SELECT 1 FROM user_modules um
        WHERE um.user_id = _user_id 
        AND um.module_key = _module_key 
        AND um.access_type = 'deny'
      )
    );
$$;

-- 2. Finance access
CREATE OR REPLACE FUNCTION has_finance_access(_user_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT is_admin(_user_id) OR has_module_access(_user_id, 'finance');
$$;

-- 3. Procurement access
CREATE OR REPLACE FUNCTION has_procurement_access(_user_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT is_admin(_user_id) OR has_module_access(_user_id, 'procurement') OR has_module_access(_user_id, 'sourcing');
$$;

-- 4. Warehouse access
CREATE OR REPLACE FUNCTION has_warehouse_access(_user_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT is_admin(_user_id) OR has_module_access(_user_id, 'warehouse');
$$;

-- 5. HR access
CREATE OR REPLACE FUNCTION has_hr_access(_user_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT is_admin(_user_id) OR has_module_access(_user_id, 'training') OR has_module_access(_user_id, 'hr');
$$;

-- 6. Construction access
CREATE OR REPLACE FUNCTION has_construction_access(_user_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT is_admin(_user_id) OR has_module_access(_user_id, 'construction');
$$;

-- 7. Sales access
CREATE OR REPLACE FUNCTION has_sales_access(_user_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT is_admin(_user_id) OR has_module_access(_user_id, 'tuh-modules') OR has_module_access(_user_id, 'sales');
$$;

-- 8. Manager access
CREATE OR REPLACE FUNCTION has_manager_access(_user_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT is_admin(_user_id) OR EXISTS (
    SELECT 1 FROM user_roles ur
    JOIN roles r ON ur.role_id = r.id
    WHERE ur.user_id = _user_id 
    AND (r.app_role IN ('manager', 'admin', 'super_admin') OR r.name ILIKE '%manager%')
  );
$$;

-- 9. Senior finance access
CREATE OR REPLACE FUNCTION has_senior_finance_access(_user_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT is_admin(_user_id) OR (
    has_finance_access(_user_id) AND has_manager_access(_user_id)
  );
$$;

-- ============================================
-- RECREATE DROPPED POLICIES FOR JOURNAL ENTRIES
-- ============================================

CREATE POLICY "Hierarchical finance access to journal entries"
ON journal_entries FOR SELECT
USING (
  is_admin(auth.uid()) OR
  (can_access_company(company_id) AND has_senior_finance_access(auth.uid()))
);

CREATE POLICY "Hierarchical finance access to journal entry lines"
ON journal_entry_lines FOR SELECT
USING (
  is_admin(auth.uid()) OR
  EXISTS (
    SELECT 1 FROM journal_entries je
    WHERE je.id = journal_entry_lines.journal_entry_id
    AND can_access_company(je.company_id)
    AND has_senior_finance_access(auth.uid())
  )
);

-- ============================================
-- TIGHTEN RLS POLICIES FOR SENSITIVE TABLES
-- ============================================

-- PROFILES
DROP POLICY IF EXISTS "Users can view all profiles" ON profiles;
DROP POLICY IF EXISTS "Users can view profiles in their company" ON profiles;
CREATE POLICY "Users can view profiles in their company"
ON profiles FOR SELECT
USING (
  is_admin(auth.uid()) OR
  (can_access_company(company_id) AND auth.uid() IS NOT NULL)
);

-- SUPPLIERS
DROP POLICY IF EXISTS "Authenticated users can view suppliers" ON suppliers;
DROP POLICY IF EXISTS "Company users can view suppliers" ON suppliers;
DROP POLICY IF EXISTS "Authorized users can view suppliers" ON suppliers;
CREATE POLICY "Authorized users can view suppliers"
ON suppliers FOR SELECT
USING (
  is_admin(auth.uid()) OR
  (can_access_company(company_id) AND 
   (has_procurement_access(auth.uid()) OR 
    has_finance_access(auth.uid()) OR
    has_manager_access(auth.uid())))
);

-- CUSTOMERS
DROP POLICY IF EXISTS "Users can view customers in their company" ON customers;
DROP POLICY IF EXISTS "Authorized users can view customers" ON customers;
CREATE POLICY "Authorized users can view customers"
ON customers FOR SELECT
USING (
  is_admin(auth.uid()) OR
  (can_access_company(company_id) AND 
   (has_sales_access(auth.uid()) OR 
    has_finance_access(auth.uid()) OR
    has_manager_access(auth.uid())))
);

-- BANK_ACCOUNTS
DROP POLICY IF EXISTS "Finance personnel can view bank accounts" ON bank_accounts;
DROP POLICY IF EXISTS "Finance can view bank accounts" ON bank_accounts;
CREATE POLICY "Finance can view bank accounts"
ON bank_accounts FOR SELECT
USING (
  is_admin(auth.uid()) OR
  (can_access_company(company_id) AND has_finance_access(auth.uid()))
);

-- BANK_TRANSACTIONS
DROP POLICY IF EXISTS "Finance users can view bank transactions" ON bank_transactions;
DROP POLICY IF EXISTS "Finance can view bank transactions" ON bank_transactions;
CREATE POLICY "Finance can view bank transactions"
ON bank_transactions FOR SELECT
USING (
  is_admin(auth.uid()) OR
  (can_access_company(company_id) AND has_finance_access(auth.uid()))
);

-- SUPPLIER_PAYMENTS
DROP POLICY IF EXISTS "Company users can view supplier payments" ON supplier_payments;
DROP POLICY IF EXISTS "Finance can view supplier payments" ON supplier_payments;
CREATE POLICY "Finance can view supplier payments"
ON supplier_payments FOR SELECT
USING (
  is_admin(auth.uid()) OR
  (can_access_company(company_id) AND has_finance_access(auth.uid()))
);

-- CONSTRUCTION_LABOUR_MASTER
DROP POLICY IF EXISTS "Authenticated users can view labour master for their company" ON construction_labour_master;
DROP POLICY IF EXISTS "HR and managers can view labour master" ON construction_labour_master;
CREATE POLICY "HR and managers can view labour master"
ON construction_labour_master FOR SELECT
USING (
  is_admin(auth.uid()) OR
  (can_access_company(company_id) AND 
   (has_hr_access(auth.uid()) OR 
    has_construction_access(auth.uid()) OR
    has_manager_access(auth.uid())))
);

-- WAREHOUSE_ASSETS
DROP POLICY IF EXISTS "Authenticated users can view warehouse assets" ON warehouse_assets;
DROP POLICY IF EXISTS "Authorized users can view warehouse assets" ON warehouse_assets;
CREATE POLICY "Authorized users can view warehouse assets"
ON warehouse_assets FOR SELECT
USING (
  is_admin(auth.uid()) OR
  (can_access_company(company_id) AND 
   (has_warehouse_access(auth.uid()) OR 
    has_finance_access(auth.uid()) OR
    has_manager_access(auth.uid())))
);

-- SUPPLIER_INVOICES
DROP POLICY IF EXISTS "Company users can view invoices" ON supplier_invoices;
DROP POLICY IF EXISTS "Authenticated users can view supplier invoices" ON supplier_invoices;
DROP POLICY IF EXISTS "Finance and procurement can view supplier invoices" ON supplier_invoices;
CREATE POLICY "Finance and procurement can view supplier invoices"
ON supplier_invoices FOR SELECT
USING (
  is_admin(auth.uid()) OR
  (can_access_company(company_id) AND 
   (has_finance_access(auth.uid()) OR has_procurement_access(auth.uid())))
);

-- PURCHASE_ORDERS
DROP POLICY IF EXISTS "Company users can view POs" ON purchase_orders;
DROP POLICY IF EXISTS "Users can view POs in their company" ON purchase_orders;
DROP POLICY IF EXISTS "Authorized users can view purchase orders" ON purchase_orders;
CREATE POLICY "Authorized users can view purchase orders"
ON purchase_orders FOR SELECT
USING (
  is_admin(auth.uid()) OR
  (can_access_company(company_id) AND 
   (has_procurement_access(auth.uid()) OR 
    has_finance_access(auth.uid()) OR
    has_warehouse_access(auth.uid()) OR
    has_manager_access(auth.uid()) OR
    created_by = auth.uid()))
);