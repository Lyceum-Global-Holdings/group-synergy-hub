
-- ============================================================
-- SECURITY: Enforce company-scoped RLS across the database
-- ============================================================

-- ---------- supabase_lov findings: drop overly broad SELECT policies ----------

-- Add scoped SELECT policies first for tables that don't have one
CREATE POLICY "Users can view purchase history for accessible assets"
ON public.asset_master_purchase_history FOR SELECT
USING (EXISTS (
  SELECT 1 FROM public.asset_master a
  WHERE a.id = asset_master_purchase_history.asset_master_id
    AND (a.company_id IS NULL OR public.can_access_company(a.company_id))
));

CREATE POLICY "Users can view BPO analytics for accessible BPOs"
ON public.blanket_po_spending_analytics FOR SELECT
USING (EXISTS (
  SELECT 1 FROM public.blanket_purchase_orders bpo
  WHERE bpo.id = blanket_po_spending_analytics.bpo_id
    AND public.can_access_company(bpo.company_id)
));

CREATE POLICY "Users can view their own dashboard permissions"
ON public.dashboard_permissions FOR SELECT
USING (user_id = auth.uid() OR public.is_admin(auth.uid()));

CREATE POLICY "Users can view DO items for accessible delivery orders"
ON public.delivery_order_items FOR SELECT
USING (EXISTS (
  SELECT 1 FROM public.delivery_orders d
  WHERE d.id = delivery_order_items.do_id
    AND public.can_access_company(d.company_id)
));

CREATE POLICY "Users can view KPI history for accessible KPIs"
ON public.kpi_history FOR SELECT
USING (EXISTS (
  SELECT 1 FROM public.kpi_definitions k
  WHERE k.id = kpi_history.kpi_id
    AND (k.company_id IS NULL OR public.can_access_company(k.company_id))
));

CREATE POLICY "Users can view packing items for accessible packing lists"
ON public.packing_list_items FOR SELECT
USING (EXISTS (
  SELECT 1 FROM public.packing_lists p
  WHERE p.id = packing_list_items.packing_list_id
    AND public.can_access_company(p.company_id)
));

CREATE POLICY "Users can view putaway items for accessible putaway records"
ON public.putaway_items FOR SELECT
USING (EXISTS (
  SELECT 1 FROM public.putaway_records pr
  WHERE pr.id = putaway_items.putaway_id
    AND public.can_access_company(pr.company_id)
));

CREATE POLICY "Users can view risk history for accessible risk flags"
ON public.risk_flag_history FOR SELECT
USING (EXISTS (
  SELECT 1 FROM public.supplier_risk_flags srf
  WHERE srf.id = risk_flag_history.risk_flag_id
    AND (srf.company_id IS NULL OR public.can_access_company(srf.company_id))
));

CREATE POLICY "Users can view supplier risk flags for their company"
ON public.supplier_risk_flags FOR SELECT
USING (company_id IS NULL OR public.can_access_company(company_id));

CREATE POLICY "Users can view warehouse item reservations for their company"
ON public.warehouse_item_reservations FOR SELECT
USING (company_id IS NULL OR public.can_access_company(company_id));

-- Now drop the broad auth-only SELECT policies on all listed tables
DROP POLICY IF EXISTS "Authenticated users can view purchase history" ON public.asset_master_purchase_history;
DROP POLICY IF EXISTS "Users can view blacklist reviews" ON public.blacklist_reviews;
DROP POLICY IF EXISTS "Authenticated users can view amendments" ON public.blanket_po_amendments;
DROP POLICY IF EXISTS "Authenticated users can view release items" ON public.blanket_po_release_items;
DROP POLICY IF EXISTS "Authenticated users can view releases" ON public.blanket_po_releases;
DROP POLICY IF EXISTS "Authenticated users can view analytics" ON public.blanket_po_spending_analytics;
DROP POLICY IF EXISTS "Authenticated users can view substitutions" ON public.bom_item_substitutions;
DROP POLICY IF EXISTS "Users can view cost centers" ON public.cost_centers;
DROP POLICY IF EXISTS "Authenticated users can view adjustments" ON public.cycle_count_adjustments;
DROP POLICY IF EXISTS "Authenticated users can view schedules" ON public.cycle_count_schedules;
DROP POLICY IF EXISTS "Users can view permissions for accessible dashboards" ON public.dashboard_permissions;
DROP POLICY IF EXISTS "Users can view DO items" ON public.delivery_order_items;
DROP POLICY IF EXISTS "Users can view delivery orders" ON public.delivery_orders;
DROP POLICY IF EXISTS "Authenticated users can view rules" ON public.evaluation_rules;
DROP POLICY IF EXISTS "Authenticated users can view approval history" ON public.finished_goods_batch_approvals;
DROP POLICY IF EXISTS "Users can view FG issues" ON public.finished_goods_issues;
DROP POLICY IF EXISTS "Users can view fiscal years" ON public.fiscal_years;
DROP POLICY IF EXISTS "Users can view KPI history" ON public.kpi_history;
DROP POLICY IF EXISTS "Users can view packing list items" ON public.packing_list_items;
DROP POLICY IF EXISTS "Users can view PO amendments" ON public.po_amendments;
DROP POLICY IF EXISTS "Authenticated users can view putaway items" ON public.putaway_items;
DROP POLICY IF EXISTS "Authenticated users can view comparisons" ON public.quote_comparisons;
DROP POLICY IF EXISTS "Authenticated users can view evaluations" ON public.quote_evaluations;
DROP POLICY IF EXISTS "Users can view recurring templates" ON public.recurring_journal_templates;
DROP POLICY IF EXISTS "Users can view risk flag history" ON public.risk_flag_history;
DROP POLICY IF EXISTS "Authenticated users can view transfer items" ON public.stock_transfer_items;
DROP POLICY IF EXISTS "Authenticated users can view transfer requests" ON public.stock_transfer_requests;
DROP POLICY IF EXISTS "Authenticated users can view action items" ON public.supplier_action_items;
DROP POLICY IF EXISTS "Authenticated users can view analytics cache" ON public.supplier_analytics_cache;
DROP POLICY IF EXISTS "Authenticated users can view workflow" ON public.supplier_approval_workflow;
DROP POLICY IF EXISTS "Users can view blacklist entries" ON public.supplier_blacklist;
DROP POLICY IF EXISTS "Authenticated users can view quotes" ON public.supplier_quotes;
DROP POLICY IF EXISTS "Authenticated users can view recommendations" ON public.supplier_recommendations;
DROP POLICY IF EXISTS "Users can view risk flags for accessible suppliers" ON public.supplier_risk_flags;
DROP POLICY IF EXISTS "Users can view tax codes" ON public.tax_codes;
DROP POLICY IF EXISTS "Users can view GL mappings" ON public.transaction_to_gl_mapping;
DROP POLICY IF EXISTS "Users can view reservations" ON public.warehouse_item_reservations;

-- approval_routing_rules: tighten its OR-permissive policy too
DROP POLICY IF EXISTS "Routing rules select" ON public.approval_routing_rules;
CREATE POLICY "Routing rules select"
ON public.approval_routing_rules FOR SELECT
USING (company_id IS NULL OR public.can_access_company(company_id) OR public.is_admin(auth.uid()));

-- ---------- user_location_permissions: scope SELECT ----------
DROP POLICY IF EXISTS "Authenticated users can view location permissions" ON public.user_location_permissions;
CREATE POLICY "Users view their own location permissions"
ON public.user_location_permissions FOR SELECT
USING (user_id = auth.uid() OR public.is_admin(auth.uid()));

-- ---------- customer-documents storage: add company-membership check ----------
DROP POLICY IF EXISTS "Users can view their own customer documents" ON storage.objects;
DROP POLICY IF EXISTS "Users can upload customer documents for their customers" ON storage.objects;
DROP POLICY IF EXISTS "Users can update customer documents for their customers" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete customer documents for their customers" ON storage.objects;

CREATE POLICY "Users can view customer documents in their company"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'customer-documents'
  AND auth.uid() IS NOT NULL
  AND EXISTS (
    SELECT 1 FROM public.customers c
    WHERE c.id::text = (storage.foldername(name))[1]
      AND (
        public.is_admin(auth.uid())
        OR (c.company_id IS NOT NULL AND public.can_access_company(c.company_id))
      )
  )
);

CREATE POLICY "Users can upload customer documents in their company"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'customer-documents'
  AND auth.uid() IS NOT NULL
  AND EXISTS (
    SELECT 1 FROM public.customers c
    WHERE c.id::text = (storage.foldername(name))[1]
      AND (
        public.is_admin(auth.uid())
        OR (c.company_id IS NOT NULL AND public.can_access_company(c.company_id))
      )
  )
);

CREATE POLICY "Users can update customer documents in their company"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'customer-documents'
  AND auth.uid() IS NOT NULL
  AND EXISTS (
    SELECT 1 FROM public.customers c
    WHERE c.id::text = (storage.foldername(name))[1]
      AND (
        public.is_admin(auth.uid())
        OR (c.company_id IS NOT NULL AND public.can_access_company(c.company_id))
      )
  )
);

CREATE POLICY "Users can delete customer documents in their company"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'customer-documents'
  AND auth.uid() IS NOT NULL
  AND EXISTS (
    SELECT 1 FROM public.customers c
    WHERE c.id::text = (storage.foldername(name))[1]
      AND (
        public.is_admin(auth.uid())
        OR (c.company_id IS NOT NULL AND public.can_access_company(c.company_id))
      )
  )
);

-- ---------- agent_security: tool tables write isolation ----------
DROP POLICY IF EXISTS "Users can delete tool issues" ON public.tool_issues;
DROP POLICY IF EXISTS "Users can update tool issues" ON public.tool_issues;
CREATE POLICY "Users can update tool issues in their company"
ON public.tool_issues FOR UPDATE
USING (auth.uid() IS NOT NULL AND (company_id IS NULL OR public.can_access_company(company_id)))
WITH CHECK (auth.uid() IS NOT NULL AND (company_id IS NULL OR public.can_access_company(company_id)));
CREATE POLICY "Users can delete tool issues in their company"
ON public.tool_issues FOR DELETE
USING (auth.uid() IS NOT NULL AND (company_id IS NULL OR public.can_access_company(company_id)));

DROP POLICY IF EXISTS "Users can create tool returns" ON public.tool_returns;
DROP POLICY IF EXISTS "Users can update tool returns" ON public.tool_returns;
DROP POLICY IF EXISTS "Users can delete tool returns" ON public.tool_returns;
CREATE POLICY "Users can create tool returns in their company"
ON public.tool_returns FOR INSERT
WITH CHECK (auth.uid() IS NOT NULL AND (company_id IS NULL OR public.can_access_company(company_id)));
CREATE POLICY "Users can update tool returns in their company"
ON public.tool_returns FOR UPDATE
USING (auth.uid() IS NOT NULL AND (company_id IS NULL OR public.can_access_company(company_id)))
WITH CHECK (auth.uid() IS NOT NULL AND (company_id IS NULL OR public.can_access_company(company_id)));
CREATE POLICY "Users can delete tool returns in their company"
ON public.tool_returns FOR DELETE
USING (auth.uid() IS NOT NULL AND (company_id IS NULL OR public.can_access_company(company_id)));

DROP POLICY IF EXISTS "Authenticated users can insert tool adjustments" ON public.tool_adjustments;
DROP POLICY IF EXISTS "Authenticated users can update tool adjustments" ON public.tool_adjustments;
DROP POLICY IF EXISTS "Authenticated users can delete tool adjustments" ON public.tool_adjustments;
CREATE POLICY "Users can insert tool adjustments in their company"
ON public.tool_adjustments FOR INSERT
WITH CHECK (auth.uid() IS NOT NULL AND (company_id IS NULL OR public.can_access_company(company_id)));
CREATE POLICY "Users can update tool adjustments in their company"
ON public.tool_adjustments FOR UPDATE
USING (auth.uid() IS NOT NULL AND (company_id IS NULL OR public.can_access_company(company_id)))
WITH CHECK (auth.uid() IS NOT NULL AND (company_id IS NULL OR public.can_access_company(company_id)));
CREATE POLICY "Users can delete tool adjustments in their company"
ON public.tool_adjustments FOR DELETE
USING (auth.uid() IS NOT NULL AND (company_id IS NULL OR public.can_access_company(company_id)));

-- ---------- warehouse_tools write isolation ----------
DROP POLICY IF EXISTS "Users can create warehouse tools" ON public.warehouse_tools;
DROP POLICY IF EXISTS "Users can update warehouse tools" ON public.warehouse_tools;
CREATE POLICY "Users can create warehouse tools in their company"
ON public.warehouse_tools FOR INSERT
WITH CHECK (auth.uid() IS NOT NULL AND (company_id IS NULL OR public.can_access_company(company_id)));
CREATE POLICY "Users can update warehouse tools in their company"
ON public.warehouse_tools FOR UPDATE
USING (auth.uid() IS NOT NULL AND (company_id IS NULL OR public.can_access_company(company_id)))
WITH CHECK (auth.uid() IS NOT NULL AND (company_id IS NULL OR public.can_access_company(company_id)));

-- ---------- construction sub-tables write isolation ----------
-- project_budget_items (has company_id)
DROP POLICY IF EXISTS "Authenticated users can create budget items" ON public.project_budget_items;
DROP POLICY IF EXISTS "Authenticated users can update budget items" ON public.project_budget_items;
DROP POLICY IF EXISTS "Authenticated users can delete budget items" ON public.project_budget_items;
CREATE POLICY "Users manage budget items in their company"
ON public.project_budget_items FOR INSERT
WITH CHECK (auth.uid() IS NOT NULL AND (company_id IS NULL OR public.can_access_company(company_id)));
CREATE POLICY "Users update budget items in their company"
ON public.project_budget_items FOR UPDATE
USING (auth.uid() IS NOT NULL AND (company_id IS NULL OR public.can_access_company(company_id)))
WITH CHECK (auth.uid() IS NOT NULL AND (company_id IS NULL OR public.can_access_company(company_id)));
CREATE POLICY "Users delete budget items in their company"
ON public.project_budget_items FOR DELETE
USING (auth.uid() IS NOT NULL AND (company_id IS NULL OR public.can_access_company(company_id)));

-- safety_inspections (has company_id)
DROP POLICY IF EXISTS "Authenticated users can create safety inspections" ON public.safety_inspections;
DROP POLICY IF EXISTS "Authenticated users can update safety inspections" ON public.safety_inspections;
DROP POLICY IF EXISTS "Authenticated users can delete safety inspections" ON public.safety_inspections;
CREATE POLICY "Users insert safety inspections in their company"
ON public.safety_inspections FOR INSERT
WITH CHECK (auth.uid() IS NOT NULL AND (company_id IS NULL OR public.can_access_company(company_id)));
CREATE POLICY "Users update safety inspections in their company"
ON public.safety_inspections FOR UPDATE
USING (auth.uid() IS NOT NULL AND (company_id IS NULL OR public.can_access_company(company_id)))
WITH CHECK (auth.uid() IS NOT NULL AND (company_id IS NULL OR public.can_access_company(company_id)));
CREATE POLICY "Users delete safety inspections in their company"
ON public.safety_inspections FOR DELETE
USING (auth.uid() IS NOT NULL AND (company_id IS NULL OR public.can_access_company(company_id)));

-- safety_incidents (has company_id)
DROP POLICY IF EXISTS "Authenticated users can create safety incidents" ON public.safety_incidents;
DROP POLICY IF EXISTS "Authenticated users can update safety incidents" ON public.safety_incidents;
DROP POLICY IF EXISTS "Authenticated users can delete safety incidents" ON public.safety_incidents;
CREATE POLICY "Users insert safety incidents in their company"
ON public.safety_incidents FOR INSERT
WITH CHECK (auth.uid() IS NOT NULL AND (company_id IS NULL OR public.can_access_company(company_id)));
CREATE POLICY "Users update safety incidents in their company"
ON public.safety_incidents FOR UPDATE
USING (auth.uid() IS NOT NULL AND (company_id IS NULL OR public.can_access_company(company_id)))
WITH CHECK (auth.uid() IS NOT NULL AND (company_id IS NULL OR public.can_access_company(company_id)));
CREATE POLICY "Users delete safety incidents in their company"
ON public.safety_incidents FOR DELETE
USING (auth.uid() IS NOT NULL AND (company_id IS NULL OR public.can_access_company(company_id)));

-- quality_inspection_items (no company_id; join via quality_inspections)
DROP POLICY IF EXISTS "Authenticated users can create inspection items" ON public.quality_inspection_items;
DROP POLICY IF EXISTS "Authenticated users can update inspection items" ON public.quality_inspection_items;
DROP POLICY IF EXISTS "Authenticated users can delete inspection items" ON public.quality_inspection_items;
CREATE POLICY "Users insert inspection items in their company"
ON public.quality_inspection_items FOR INSERT
WITH CHECK (auth.uid() IS NOT NULL AND EXISTS (
  SELECT 1 FROM public.quality_inspections qi
  WHERE qi.id = quality_inspection_items.inspection_id
    AND public.can_access_company(qi.company_id)
));
CREATE POLICY "Users update inspection items in their company"
ON public.quality_inspection_items FOR UPDATE
USING (auth.uid() IS NOT NULL AND EXISTS (
  SELECT 1 FROM public.quality_inspections qi
  WHERE qi.id = quality_inspection_items.inspection_id
    AND public.can_access_company(qi.company_id)
));
CREATE POLICY "Users delete inspection items in their company"
ON public.quality_inspection_items FOR DELETE
USING (auth.uid() IS NOT NULL AND EXISTS (
  SELECT 1 FROM public.quality_inspections qi
  WHERE qi.id = quality_inspection_items.inspection_id
    AND public.can_access_company(qi.company_id)
));

-- site_report_activities (no company_id; join via daily_site_reports)
DROP POLICY IF EXISTS "Authenticated users can create report activities" ON public.site_report_activities;
DROP POLICY IF EXISTS "Authenticated users can update report activities" ON public.site_report_activities;
DROP POLICY IF EXISTS "Authenticated users can delete report activities" ON public.site_report_activities;
CREATE POLICY "Users insert report activities in their company"
ON public.site_report_activities FOR INSERT
WITH CHECK (auth.uid() IS NOT NULL AND EXISTS (
  SELECT 1 FROM public.daily_site_reports dsr
  WHERE dsr.id = site_report_activities.report_id
    AND (dsr.company_id IS NULL OR public.can_access_company(dsr.company_id))
));
CREATE POLICY "Users update report activities in their company"
ON public.site_report_activities FOR UPDATE
USING (auth.uid() IS NOT NULL AND EXISTS (
  SELECT 1 FROM public.daily_site_reports dsr
  WHERE dsr.id = site_report_activities.report_id
    AND (dsr.company_id IS NULL OR public.can_access_company(dsr.company_id))
));
CREATE POLICY "Users delete report activities in their company"
ON public.site_report_activities FOR DELETE
USING (auth.uid() IS NOT NULL AND EXISTS (
  SELECT 1 FROM public.daily_site_reports dsr
  WHERE dsr.id = site_report_activities.report_id
    AND (dsr.company_id IS NULL OR public.can_access_company(dsr.company_id))
));

-- project_warehouse_allocations (has company_id)
DROP POLICY IF EXISTS "Authenticated users can create project warehouse allocations" ON public.project_warehouse_allocations;
DROP POLICY IF EXISTS "Authenticated users can update project warehouse allocations" ON public.project_warehouse_allocations;
DROP POLICY IF EXISTS "Authenticated users can delete project warehouse allocations" ON public.project_warehouse_allocations;
CREATE POLICY "Users insert project allocations in their company"
ON public.project_warehouse_allocations FOR INSERT
WITH CHECK (auth.uid() IS NOT NULL AND (company_id IS NULL OR public.can_access_company(company_id)));
CREATE POLICY "Users update project allocations in their company"
ON public.project_warehouse_allocations FOR UPDATE
USING (auth.uid() IS NOT NULL AND (company_id IS NULL OR public.can_access_company(company_id)))
WITH CHECK (auth.uid() IS NOT NULL AND (company_id IS NULL OR public.can_access_company(company_id)));
CREATE POLICY "Users delete project allocations in their company"
ON public.project_warehouse_allocations FOR DELETE
USING (auth.uid() IS NOT NULL AND (company_id IS NULL OR public.can_access_company(company_id)));

-- ---------- stock_transactions UPDATE scoping ----------
DROP POLICY IF EXISTS "Authenticated users can update stock transactions" ON public.stock_transactions;
CREATE POLICY "Users update stock transactions in their company"
ON public.stock_transactions FOR UPDATE
USING (auth.uid() IS NOT NULL AND (company_id IS NULL OR public.can_access_company(company_id)))
WITH CHECK (auth.uid() IS NOT NULL AND (company_id IS NULL OR public.can_access_company(company_id)));
