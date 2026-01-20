-- Security Hardening Migration - Phase 2 (Corrected)
-- Fixes remaining security issues - drops duplicates first

-- ============================================
-- Part 1: Fix Function Search Path Vulnerabilities
-- ============================================

-- Fix generate_labour_employee_id function
CREATE OR REPLACE FUNCTION public.generate_labour_employee_id()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  new_seq INTEGER;
  prefix TEXT := 'EMP';
BEGIN
  SELECT COALESCE(MAX(CAST(SUBSTRING(employee_id FROM 4) AS INTEGER)), 0) + 1
  INTO new_seq
  FROM construction_labour_master
  WHERE employee_id LIKE 'EMP%';
  
  NEW.employee_id := prefix || LPAD(new_seq::TEXT, 5, '0');
  RETURN NEW;
END;
$function$;

-- Fix update_batch_status function
CREATE OR REPLACE FUNCTION public.update_batch_status()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  IF NEW.quantity_remaining <= 0 THEN
    NEW.status := 'depleted';
  ELSIF NEW.expiry_date IS NOT NULL AND NEW.expiry_date < CURRENT_DATE THEN
    NEW.status := 'expired';
  ELSIF NEW.status = 'depleted' AND NEW.quantity_remaining > 0 THEN
    NEW.status := 'active';
  END IF;
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$function$;

-- ============================================
-- Part 2: Create Sales Access Helper Function
-- ============================================

CREATE OR REPLACE FUNCTION public.has_sales_access(_user_id uuid)
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
         OR r.department = 'Sales'
         OR r.name ILIKE '%sales%'
         OR r.name ILIKE '%warehouse%')
  ) OR public.is_admin(_user_id);
$$;

-- ============================================
-- Part 3: Fix Construction Inventory Transactions RLS
-- Drop duplicate/permissive policies
-- ============================================

DROP POLICY IF EXISTS "Users can insert construction inventory transactions" ON public.construction_inventory_transactions;
DROP POLICY IF EXISTS "Users can update construction inventory transactions" ON public.construction_inventory_transactions;
DROP POLICY IF EXISTS "Construction users can insert inventory transactions" ON public.construction_inventory_transactions;
DROP POLICY IF EXISTS "Construction users can modify inventory transactions" ON public.construction_inventory_transactions;

CREATE POLICY "Construction users can insert inventory transactions"
ON public.construction_inventory_transactions FOR INSERT
WITH CHECK (can_access_company(company_id) AND has_construction_access(auth.uid()));

CREATE POLICY "Construction users can update inventory transactions"
ON public.construction_inventory_transactions FOR UPDATE
USING (can_access_company(company_id) AND (created_by = auth.uid() OR is_admin(auth.uid())));

-- ============================================
-- Part 4: Fix Construction Labour Master RLS
-- Drop duplicate/permissive policies
-- ============================================

DROP POLICY IF EXISTS "Authenticated users can delete labour master" ON public.construction_labour_master;
DROP POLICY IF EXISTS "Authenticated users can insert labour master" ON public.construction_labour_master;
DROP POLICY IF EXISTS "Authenticated users can update labour master" ON public.construction_labour_master;
DROP POLICY IF EXISTS "Construction users can insert labour records" ON public.construction_labour_master;
DROP POLICY IF EXISTS "Construction users can modify labour records" ON public.construction_labour_master;
DROP POLICY IF EXISTS "Only admins can delete labour records" ON public.construction_labour_master;

CREATE POLICY "Construction users can insert labour master"
ON public.construction_labour_master FOR INSERT
WITH CHECK (can_access_company(company_id) AND has_construction_access(auth.uid()));

CREATE POLICY "Construction users can update labour master"
ON public.construction_labour_master FOR UPDATE
USING (can_access_company(company_id) AND (created_by = auth.uid() OR is_admin(auth.uid())));

CREATE POLICY "Admins can delete labour master"
ON public.construction_labour_master FOR DELETE
USING (can_access_company(company_id) AND is_admin(auth.uid()));

-- ============================================
-- Part 5: Fix Construction Subcontractor Master RLS
-- Drop duplicate/permissive policies
-- ============================================

DROP POLICY IF EXISTS "Authenticated users can delete subcontractor master" ON public.construction_subcontractor_master;
DROP POLICY IF EXISTS "Authenticated users can insert subcontractor master" ON public.construction_subcontractor_master;
DROP POLICY IF EXISTS "Authenticated users can update subcontractor master" ON public.construction_subcontractor_master;
DROP POLICY IF EXISTS "Construction users can insert subcontractors" ON public.construction_subcontractor_master;
DROP POLICY IF EXISTS "Construction users can modify subcontractors" ON public.construction_subcontractor_master;
DROP POLICY IF EXISTS "Only admins can delete subcontractors" ON public.construction_subcontractor_master;

CREATE POLICY "Construction users can insert subcontractor master"
ON public.construction_subcontractor_master FOR INSERT
WITH CHECK (can_access_company(company_id) AND has_construction_access(auth.uid()));

CREATE POLICY "Construction users can update subcontractor master"
ON public.construction_subcontractor_master FOR UPDATE
USING (can_access_company(company_id) AND (created_by = auth.uid() OR is_admin(auth.uid())));

CREATE POLICY "Admins can delete subcontractor master"
ON public.construction_subcontractor_master FOR DELETE
USING (can_access_company(company_id) AND is_admin(auth.uid()));

-- ============================================
-- Part 6: Fix Depreciation Schedule RLS
-- Drop duplicate/permissive policies
-- ============================================

DROP POLICY IF EXISTS "Users can delete depreciation schedule" ON public.depreciation_schedule;
DROP POLICY IF EXISTS "Users can create depreciation schedule" ON public.depreciation_schedule;
DROP POLICY IF EXISTS "Users can update depreciation schedule" ON public.depreciation_schedule;
DROP POLICY IF EXISTS "Finance users can create depreciation entries" ON public.depreciation_schedule;
DROP POLICY IF EXISTS "Finance users can update depreciation entries" ON public.depreciation_schedule;
DROP POLICY IF EXISTS "Only admins can delete depreciation entries" ON public.depreciation_schedule;

CREATE POLICY "Finance users can create depreciation schedule"
ON public.depreciation_schedule FOR INSERT
WITH CHECK (can_access_company(company_id) AND has_finance_access(auth.uid()));

CREATE POLICY "Finance users can update depreciation schedule"
ON public.depreciation_schedule FOR UPDATE
USING (can_access_company(company_id) AND has_finance_access(auth.uid()));

CREATE POLICY "Admins can delete depreciation schedule"
ON public.depreciation_schedule FOR DELETE
USING (can_access_company(company_id) AND is_admin(auth.uid()));

-- ============================================
-- Part 7: Harden Customer Invoice Access
-- ============================================

DROP POLICY IF EXISTS "Users can view customer invoices" ON public.customer_invoices;

CREATE POLICY "Finance users can view customer invoices"
ON public.customer_invoices FOR SELECT
USING (can_access_company(company_id) AND has_finance_access(auth.uid()));

-- ============================================
-- Part 8: Restrict Sales Orders Access
-- ============================================

DROP POLICY IF EXISTS "Authenticated users can view sales orders" ON public.sales_orders;

CREATE POLICY "Sales and warehouse users can view sales orders"
ON public.sales_orders FOR SELECT
USING (can_access_company(company_id) AND has_sales_access(auth.uid()));

-- ============================================
-- Part 9: Improve Profiles Table Security
-- ============================================

DROP POLICY IF EXISTS "Users can view profiles in their company" ON public.profiles;

CREATE POLICY "Users can view own profile or company profiles"
ON public.profiles FOR SELECT
USING (
  user_id = auth.uid() 
  OR (can_access_company(company_id) AND is_admin(auth.uid()))
);