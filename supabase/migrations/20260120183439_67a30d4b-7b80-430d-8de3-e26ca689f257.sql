-- Security Hardening Phase 5: Remaining RLS Policies

-- ============================================
-- PART 4: Fix Child Tables (JOIN-based policies)
-- ============================================

-- supplier_invoice_lines (inherits from supplier_invoices)
DROP POLICY IF EXISTS "Finance users can view supplier invoice lines" ON public.supplier_invoice_lines;
DROP POLICY IF EXISTS "Users can view supplier invoice lines" ON public.supplier_invoice_lines;
CREATE POLICY "Finance users can view supplier invoice lines"
ON public.supplier_invoice_lines FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.supplier_invoices si
    WHERE si.id = supplier_invoice_lines.invoice_id
    AND can_access_company(si.company_id)
    AND has_finance_access(auth.uid())
  )
);

-- quality_inspection_items (inherits from quality_inspections)
DROP POLICY IF EXISTS "Construction users can view inspection items" ON public.quality_inspection_items;
DROP POLICY IF EXISTS "Users can view inspection items" ON public.quality_inspection_items;
DROP POLICY IF EXISTS "Authenticated users can view inspection items" ON public.quality_inspection_items;
CREATE POLICY "Construction users can view inspection items"
ON public.quality_inspection_items FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.quality_inspections qi
    WHERE qi.id = quality_inspection_items.inspection_id
    AND can_access_company(qi.company_id)
    AND has_construction_access(auth.uid())
  )
);

-- site_report_activities (inherits from daily_site_reports)
DROP POLICY IF EXISTS "Construction users can view report activities" ON public.site_report_activities;
DROP POLICY IF EXISTS "Users can view report activities" ON public.site_report_activities;
DROP POLICY IF EXISTS "Authenticated users can view report activities" ON public.site_report_activities;
CREATE POLICY "Construction users can view report activities"
ON public.site_report_activities FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.daily_site_reports dsr
    WHERE dsr.id = site_report_activities.report_id
    AND can_access_company(dsr.company_id)
    AND has_construction_access(auth.uid())
  )
);

-- ============================================
-- PART 5: Fix Warehouse & Misc Tables
-- ============================================

-- project_warehouse_allocations
DROP POLICY IF EXISTS "Warehouse users can view allocations" ON public.project_warehouse_allocations;
DROP POLICY IF EXISTS "Users can view project warehouse allocations" ON public.project_warehouse_allocations;
DROP POLICY IF EXISTS "Authenticated users can view project warehouse allocations" ON public.project_warehouse_allocations;
CREATE POLICY "Warehouse users can view allocations"
ON public.project_warehouse_allocations FOR SELECT
USING (can_access_company(company_id) AND has_warehouse_access(auth.uid()));

-- project_budget_items
DROP POLICY IF EXISTS "Finance users can view budget items" ON public.project_budget_items;
DROP POLICY IF EXISTS "Users can view budget items" ON public.project_budget_items;
DROP POLICY IF EXISTS "Authenticated users can view budget items" ON public.project_budget_items;
CREATE POLICY "Finance users can view budget items"
ON public.project_budget_items FOR SELECT
USING (can_access_company(company_id) AND has_finance_access(auth.uid()));

-- telegram_settings (admin only)
DROP POLICY IF EXISTS "Admins can view telegram settings" ON public.telegram_settings;
DROP POLICY IF EXISTS "Users can view telegram_settings" ON public.telegram_settings;
DROP POLICY IF EXISTS "Authenticated users can view telegram_settings" ON public.telegram_settings;
CREATE POLICY "Admins can view telegram settings"
ON public.telegram_settings FOR SELECT
USING (can_access_company(company_id) AND is_admin(auth.uid()));

-- approver_assignments
DROP POLICY IF EXISTS "Users can view own or admin can view all approver assignments" ON public.approver_assignments;
DROP POLICY IF EXISTS "Users can view approver assignments" ON public.approver_assignments;
DROP POLICY IF EXISTS "Authenticated users can view approver assignments" ON public.approver_assignments;
CREATE POLICY "Users can view own or admin can view all approver assignments"
ON public.approver_assignments FOR SELECT
USING (
  can_access_company(company_id) AND 
  (user_id = auth.uid() OR is_admin(auth.uid()))
);

-- ============================================
-- PART 6: Fix GRN Items Post-Approval Edit
-- ============================================

DROP POLICY IF EXISTS "Users can update draft GRN items only" ON public.grn_items;
DROP POLICY IF EXISTS "Users can update GRN items" ON public.grn_items;
DROP POLICY IF EXISTS "Authenticated users can update GRN items" ON public.grn_items;
CREATE POLICY "Users can update draft GRN items only"
ON public.grn_items FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.goods_receipt_notes grn
    WHERE grn.id = grn_items.grn_id
    AND grn.status = 'draft'
    AND (grn.created_by = auth.uid() OR is_admin(auth.uid()))
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.goods_receipt_notes grn
    WHERE grn.id = grn_items.grn_id
    AND grn.status = 'draft'
  )
);

-- ============================================
-- PART 7: Add Confidentiality Check to Contracts
-- ============================================

DROP POLICY IF EXISTS "Users can view non-confidential or owned contracts" ON public.contracts;
DROP POLICY IF EXISTS "Users can view contracts" ON public.contracts;
DROP POLICY IF EXISTS "Authenticated users can view contracts" ON public.contracts;
CREATE POLICY "Users can view non-confidential or owned contracts"
ON public.contracts FOR SELECT
USING (
  can_access_company(company_id) AND (
    COALESCE(confidentiality_level, 'internal') IN ('public', 'internal') OR
    created_by = auth.uid() OR
    owner_id = auth.uid() OR
    is_admin(auth.uid())
  )
);

-- ============================================
-- PART 8: Fix Labour Master PII Protection
-- ============================================

DROP POLICY IF EXISTS "HR and managers can view labour master" ON public.construction_labour_master;
DROP POLICY IF EXISTS "Construction users can view labour master" ON public.construction_labour_master;
DROP POLICY IF EXISTS "Authenticated users can view labour master" ON public.construction_labour_master;
CREATE POLICY "HR and managers can view labour master"
ON public.construction_labour_master FOR SELECT
USING (
  can_access_company(company_id) AND 
  (has_construction_access(auth.uid()) OR has_manager_access(auth.uid()) OR has_hr_access(auth.uid()))
);

-- ============================================
-- PART 9: Fix Safety Tables (HR access)
-- ============================================

DROP POLICY IF EXISTS "Construction and HR can view safety incidents" ON public.safety_incidents;
DROP POLICY IF EXISTS "Users can view safety incidents" ON public.safety_incidents;
DROP POLICY IF EXISTS "Authenticated users can view safety incidents" ON public.safety_incidents;
CREATE POLICY "Construction and HR can view safety incidents"
ON public.safety_incidents FOR SELECT
USING (
  can_access_company(company_id) AND 
  (has_construction_access(auth.uid()) OR has_hr_access(auth.uid()))
);

DROP POLICY IF EXISTS "Construction and HR can view safety inspections" ON public.safety_inspections;
DROP POLICY IF EXISTS "Users can view safety inspections" ON public.safety_inspections;
DROP POLICY IF EXISTS "Authenticated users can view safety inspections" ON public.safety_inspections;
CREATE POLICY "Construction and HR can view safety inspections"
ON public.safety_inspections FOR SELECT
USING (
  can_access_company(company_id) AND 
  (has_construction_access(auth.uid()) OR has_hr_access(auth.uid()))
);