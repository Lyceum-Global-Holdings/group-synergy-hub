
DROP POLICY IF EXISTS "Users can view PRs they created or if admin" ON public.purchase_requisitions;
CREATE POLICY "Users can view PRs in their company" ON public.purchase_requisitions FOR SELECT
  USING (auth.uid() = requested_by OR is_admin(auth.uid()) OR can_access_company(company_id));

DROP POLICY IF EXISTS "Authenticated users can view RFQ/RFP requests" ON public.rfq_rfp_requests;
CREATE POLICY "Users can view RFQ/RFP requests in their company" ON public.rfq_rfp_requests FOR SELECT
  USING (can_access_company(company_id));

DROP POLICY IF EXISTS "Authenticated users can view supplier quotes" ON public.supplier_quotes;
CREATE POLICY "Users can view supplier quotes in their company" ON public.supplier_quotes FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.rfq_rfp_requests r WHERE r.id = supplier_quotes.request_id AND can_access_company(r.company_id)));

DROP POLICY IF EXISTS "Authenticated users can view BPOs" ON public.blanket_purchase_orders;
CREATE POLICY "Users can view BPOs in their company" ON public.blanket_purchase_orders FOR SELECT
  USING (can_access_company(company_id));

DROP POLICY IF EXISTS "Authenticated users can view BPO items" ON public.blanket_po_items;
CREATE POLICY "Users can view BPO items in their company" ON public.blanket_po_items FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.blanket_purchase_orders b WHERE b.id = blanket_po_items.bpo_id AND can_access_company(b.company_id)));

DROP POLICY IF EXISTS "Authenticated users can view BPO releases" ON public.blanket_po_releases;
CREATE POLICY "Users can view BPO releases in their company" ON public.blanket_po_releases FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.blanket_purchase_orders b WHERE b.id = blanket_po_releases.bpo_id AND can_access_company(b.company_id)));

DROP POLICY IF EXISTS "Authenticated users can view BPO release items" ON public.blanket_po_release_items;
CREATE POLICY "Users can view BPO release items in their company" ON public.blanket_po_release_items FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.blanket_po_releases r JOIN public.blanket_purchase_orders b ON b.id = r.bpo_id WHERE r.id = blanket_po_release_items.release_id AND can_access_company(b.company_id)));

DROP POLICY IF EXISTS "Authenticated users can view BPO amendments" ON public.blanket_po_amendments;
CREATE POLICY "Users can view BPO amendments in their company" ON public.blanket_po_amendments FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.blanket_purchase_orders b WHERE b.id = blanket_po_amendments.bpo_id AND can_access_company(b.company_id)));

DROP POLICY IF EXISTS "Authenticated users can view PO amendments" ON public.po_amendments;
CREATE POLICY "Users can view PO amendments in their company" ON public.po_amendments FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.purchase_orders p WHERE p.id = po_amendments.po_id AND can_access_company(p.company_id)));

DROP POLICY IF EXISTS "Authenticated users can view customer POs" ON public.customer_purchase_orders;
CREATE POLICY "Users can view customer POs in their company" ON public.customer_purchase_orders FOR SELECT
  USING (can_access_company(company_id));

DROP POLICY IF EXISTS "Authenticated users can view BOMs" ON public.bill_of_materials;
CREATE POLICY "Users can view BOMs in their company" ON public.bill_of_materials FOR SELECT
  USING (can_access_company(company_id));

DROP POLICY IF EXISTS "Authenticated users can view BOM items" ON public.bom_items;
CREATE POLICY "Users can view BOM items in their company" ON public.bom_items FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.bill_of_materials b WHERE b.id = bom_items.bom_id AND can_access_company(b.company_id)));

DROP POLICY IF EXISTS "Authenticated users can view BOM versions" ON public.bom_versions;
CREATE POLICY "Users can view BOM versions in their company" ON public.bom_versions FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.bill_of_materials b WHERE b.id = bom_versions.bom_id AND can_access_company(b.company_id)));

DROP POLICY IF EXISTS "Authenticated users can view BOM substitutions" ON public.bom_item_substitutions;
CREATE POLICY "Users can view BOM substitutions in their company" ON public.bom_item_substitutions FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.bom_items i JOIN public.bill_of_materials b ON b.id = i.bom_id WHERE i.id = bom_item_substitutions.bom_item_id AND can_access_company(b.company_id)));

DROP POLICY IF EXISTS "Authenticated users can view material demand" ON public.material_demand;
CREATE POLICY "Users can view material demand in their company" ON public.material_demand FOR SELECT
  USING (can_access_company(company_id));

DROP POLICY IF EXISTS "Users can view COA for their company" ON public.chart_of_accounts;
CREATE POLICY "Users can view COA in their company" ON public.chart_of_accounts FOR SELECT
  USING (can_access_company(company_id));

DROP POLICY IF EXISTS "Authenticated users can view recurring journal templates" ON public.recurring_journal_templates;
CREATE POLICY "Users can view recurring journal templates in their company" ON public.recurring_journal_templates FOR SELECT
  USING (can_access_company(company_id));

DROP POLICY IF EXISTS "Authenticated users can view transaction GL mapping" ON public.transaction_to_gl_mapping;
CREATE POLICY "Users can view GL mapping in their company" ON public.transaction_to_gl_mapping FOR SELECT
  USING (can_access_company(company_id));

DROP POLICY IF EXISTS "Authenticated users can view cost centers" ON public.cost_centers;
CREATE POLICY "Users can view cost centers in their company" ON public.cost_centers FOR SELECT
  USING (can_access_company(company_id));

DROP POLICY IF EXISTS "Authenticated users can view tax codes" ON public.tax_codes;
CREATE POLICY "Users can view tax codes in their company" ON public.tax_codes FOR SELECT
  USING (can_access_company(company_id));

DROP POLICY IF EXISTS "Authenticated users can view fiscal years" ON public.fiscal_years;
CREATE POLICY "Users can view fiscal years in their company" ON public.fiscal_years FOR SELECT
  USING (can_access_company(company_id));

DROP POLICY IF EXISTS "Authenticated users can view asset master" ON public.asset_master;
CREATE POLICY "Users can view asset master in their company" ON public.asset_master FOR SELECT
  USING (company_id IS NULL OR can_access_company(company_id));

DROP POLICY IF EXISTS "Authenticated users can view asset categories" ON public.asset_categories;
CREATE POLICY "Users can view asset categories in their company" ON public.asset_categories FOR SELECT
  USING (company_id IS NULL OR can_access_company(company_id));

DROP POLICY IF EXISTS "Authenticated users can view asset transfers" ON public.asset_transfers;
CREATE POLICY "Users can view asset transfers in their company" ON public.asset_transfers FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.asset_master a WHERE a.id = asset_transfers.asset_id AND (a.company_id IS NULL OR can_access_company(a.company_id))));

DROP POLICY IF EXISTS "Authenticated users can view supplier evaluations" ON public.supplier_evaluations;
CREATE POLICY "Users can view supplier evaluations in their company" ON public.supplier_evaluations FOR SELECT
  USING (can_access_company(company_id));

DROP POLICY IF EXISTS "Authenticated users can view supplier blacklist" ON public.supplier_blacklist;
CREATE POLICY "Users can view supplier blacklist in their company" ON public.supplier_blacklist FOR SELECT
  USING (can_access_company(company_id));

DROP POLICY IF EXISTS "Authenticated users can view blacklist reviews" ON public.blacklist_reviews;
CREATE POLICY "Users can view blacklist reviews in their company" ON public.blacklist_reviews FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.supplier_blacklist sb WHERE sb.id = blacklist_reviews.blacklist_id AND can_access_company(sb.company_id)));

DROP POLICY IF EXISTS "Authenticated users can view risk alert rules" ON public.risk_alert_rules;
CREATE POLICY "Users can view risk alert rules in their company" ON public.risk_alert_rules FOR SELECT
  USING (can_access_company(company_id));

DROP POLICY IF EXISTS "Authenticated users can view supplier registration requests" ON public.supplier_registration_requests;
CREATE POLICY "Users can view supplier registration requests in their company" ON public.supplier_registration_requests FOR SELECT
  USING (can_access_company(company_id) OR is_admin(auth.uid()));

DROP POLICY IF EXISTS "Authenticated users can view supplier approval workflow" ON public.supplier_approval_workflow;
CREATE POLICY "Users can view supplier approval workflow in their company" ON public.supplier_approval_workflow FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.supplier_registration_requests r WHERE r.id = supplier_approval_workflow.registration_request_id AND (can_access_company(r.company_id) OR is_admin(auth.uid()))));

DROP POLICY IF EXISTS "Authenticated users can view supplier analytics" ON public.supplier_analytics_cache;
CREATE POLICY "Users can view supplier analytics in their company" ON public.supplier_analytics_cache FOR SELECT
  USING (can_access_company(company_id));

DROP POLICY IF EXISTS "Authenticated users can view supplier recommendations" ON public.supplier_recommendations;
CREATE POLICY "Users can view supplier recommendations in their company" ON public.supplier_recommendations FOR SELECT
  USING (can_access_company(company_id));

DROP POLICY IF EXISTS "Authenticated users can view supplier action items" ON public.supplier_action_items;
CREATE POLICY "Users can view supplier action items in their company" ON public.supplier_action_items FOR SELECT
  USING (can_access_company(company_id));

DROP POLICY IF EXISTS "Authenticated users can view quote evaluations" ON public.quote_evaluations;
CREATE POLICY "Users can view quote evaluations in their company" ON public.quote_evaluations FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.supplier_quotes sq JOIN public.rfq_rfp_requests r ON r.id = sq.request_id WHERE sq.id = quote_evaluations.quote_id AND can_access_company(r.company_id)));

DROP POLICY IF EXISTS "Authenticated users can view quote comparisons" ON public.quote_comparisons;
CREATE POLICY "Users can view quote comparisons in their company" ON public.quote_comparisons FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.rfq_rfp_requests r WHERE r.id = quote_comparisons.request_id AND can_access_company(r.company_id)));

DROP POLICY IF EXISTS "Authenticated users can view evaluation rules" ON public.evaluation_rules;
CREATE POLICY "Users can view evaluation rules in their company" ON public.evaluation_rules FOR SELECT
  USING (can_access_company(company_id));

DROP POLICY IF EXISTS "Authenticated users can view finished goods" ON public.finished_goods;
CREATE POLICY "Users can view finished goods in their company" ON public.finished_goods FOR SELECT
  USING (can_access_company(company_id));

DROP POLICY IF EXISTS "Authenticated users can view finished goods batches" ON public.finished_goods_batches;
CREATE POLICY "Users can view finished goods batches in their company" ON public.finished_goods_batches FOR SELECT
  USING (can_access_company(company_id));

DROP POLICY IF EXISTS "Authenticated users can view finished goods issues" ON public.finished_goods_issues;
CREATE POLICY "Users can view finished goods issues in their company" ON public.finished_goods_issues FOR SELECT
  USING (can_access_company(company_id));

DROP POLICY IF EXISTS "Authenticated users can view finished goods movements" ON public.finished_goods_movements;
CREATE POLICY "Users can view finished goods movements in their company" ON public.finished_goods_movements FOR SELECT
  USING (can_access_company(company_id));

DROP POLICY IF EXISTS "Authenticated users can view finished goods reservations" ON public.finished_goods_reservations;
CREATE POLICY "Users can view finished goods reservations in their company" ON public.finished_goods_reservations FOR SELECT
  USING (can_access_company(company_id));

DROP POLICY IF EXISTS "Authenticated users can view finished goods batch approvals" ON public.finished_goods_batch_approvals;
CREATE POLICY "Users can view FG batch approvals in their company" ON public.finished_goods_batch_approvals FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.finished_goods_batches b WHERE b.id = finished_goods_batch_approvals.batch_id AND can_access_company(b.company_id)));

DROP POLICY IF EXISTS "Authenticated users can view GRNs" ON public.goods_receipt_notes;
CREATE POLICY "Users can view GRNs in their company" ON public.goods_receipt_notes FOR SELECT
  USING (can_access_company(company_id));

DROP POLICY IF EXISTS "Authenticated users can view material issue notes" ON public.material_issue_notes;
CREATE POLICY "Users can view material issue notes in their company" ON public.material_issue_notes FOR SELECT
  USING (can_access_company(company_id));

DROP POLICY IF EXISTS "Authenticated users can view material return notes" ON public.material_return_notes;
CREATE POLICY "Users can view material return notes in their company" ON public.material_return_notes FOR SELECT
  USING (can_access_company(company_id));

DROP POLICY IF EXISTS "Authenticated users can view material requests" ON public.material_requests;
CREATE POLICY "Users can view material requests in their company" ON public.material_requests FOR SELECT
  USING (can_access_company(company_id));

DROP POLICY IF EXISTS "Authenticated users can view pick lists" ON public.pick_lists;
CREATE POLICY "Users can view pick lists in their company" ON public.pick_lists FOR SELECT
  USING (can_access_company(company_id));

DROP POLICY IF EXISTS "Authenticated users can view packing lists" ON public.packing_lists;
CREATE POLICY "Users can view packing lists in their company" ON public.packing_lists FOR SELECT
  USING (can_access_company(company_id));

DROP POLICY IF EXISTS "Authenticated users can view delivery orders" ON public.delivery_orders;
CREATE POLICY "Users can view delivery orders in their company" ON public.delivery_orders FOR SELECT
  USING (can_access_company(company_id));

DROP POLICY IF EXISTS "Authenticated users can view dispatch records" ON public.dispatch_records;
CREATE POLICY "Users can view dispatch records in their company" ON public.dispatch_records FOR SELECT
  USING (can_access_company(company_id));

DROP POLICY IF EXISTS "Authenticated users can view putaway records" ON public.putaway_records;
CREATE POLICY "Users can view putaway records in their company" ON public.putaway_records FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.goods_receipt_notes g WHERE g.id = putaway_records.grn_id AND can_access_company(g.company_id)));

DROP POLICY IF EXISTS "Authenticated users can view cycle counts" ON public.cycle_counts;
CREATE POLICY "Users can view cycle counts in their company" ON public.cycle_counts FOR SELECT
  USING (can_access_company(company_id));

DROP POLICY IF EXISTS "Authenticated users can view cycle count items" ON public.cycle_count_items;
CREATE POLICY "Users can view cycle count items in their company" ON public.cycle_count_items FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.cycle_counts c WHERE c.id = cycle_count_items.cycle_count_id AND can_access_company(c.company_id)));

DROP POLICY IF EXISTS "Authenticated users can view cycle count adjustments" ON public.cycle_count_adjustments;
CREATE POLICY "Users can view cycle count adjustments in their company" ON public.cycle_count_adjustments FOR SELECT
  USING (can_access_company(company_id));

DROP POLICY IF EXISTS "Authenticated users can view cycle count schedules" ON public.cycle_count_schedules;
CREATE POLICY "Users can view cycle count schedules in their company" ON public.cycle_count_schedules FOR SELECT
  USING (can_access_company(company_id));

DROP POLICY IF EXISTS "Authenticated users can view stock transfer requests" ON public.stock_transfer_requests;
CREATE POLICY "Users can view stock transfer requests in their company" ON public.stock_transfer_requests FOR SELECT
  USING (can_access_company(company_id));

DROP POLICY IF EXISTS "Authenticated users can view stock transfer items" ON public.stock_transfer_items;
CREATE POLICY "Users can view stock transfer items in their company" ON public.stock_transfer_items FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.stock_transfer_requests t WHERE t.id = stock_transfer_items.transfer_id AND can_access_company(t.company_id)));

DROP POLICY IF EXISTS "Authenticated users can view stock adjustment batches" ON public.stock_adjustment_batches;
CREATE POLICY "Users can view stock adjustment batches in their company" ON public.stock_adjustment_batches FOR SELECT
  USING (can_access_company(company_id));

DROP POLICY IF EXISTS "Users can view labour categories for their company" ON public.construction_labour_categories;
CREATE POLICY "Users can view labour categories for their company" ON public.construction_labour_categories FOR SELECT
  USING (company_id IS NULL OR can_access_company(company_id) OR is_admin(auth.uid()) OR is_super_admin(auth.uid()));

DROP POLICY IF EXISTS "Users can view labour companies for their company" ON public.construction_labour_companies;
CREATE POLICY "Users can view labour companies for their company" ON public.construction_labour_companies FOR SELECT
  USING (company_id IS NULL OR can_access_company(company_id) OR is_admin(auth.uid()) OR is_super_admin(auth.uid()));

DROP POLICY IF EXISTS "Tenant members on project can read" ON public.construction_documents;
CREATE POLICY "Tenant members on project can read" ON public.construction_documents FOR SELECT
  USING (get_current_tenant_id() IS NOT NULL AND company_id = get_current_tenant_id() AND EXISTS (SELECT 1 FROM public.project_team_members ptm WHERE ptm.user_id = auth.uid() AND ptm.project_id = construction_documents.project_id));

UPDATE storage.buckets SET public = false WHERE id = 'floor-drawings';

DROP POLICY IF EXISTS "Anyone can view floor drawings" ON storage.objects;
CREATE POLICY "Company members can view floor drawings" ON storage.objects FOR SELECT
  USING (bucket_id = 'floor-drawings' AND auth.uid() IS NOT NULL AND (is_admin(auth.uid()) OR EXISTS (SELECT 1 FROM public.project_floor_drawings d WHERE d.image_url LIKE '%' || storage.objects.name || '%' AND can_access_company(d.company_id))));

DROP POLICY IF EXISTS "Company users can view NDA documents" ON storage.objects;
CREATE POLICY "Company users can view NDA documents" ON storage.objects FOR SELECT
  USING (bucket_id = 'social-media-nda-documents' AND auth.uid() IS NOT NULL AND (is_admin(auth.uid()) OR EXISTS (SELECT 1 FROM public.social_media_ndas n WHERE n.nda_document_url LIKE '%' || storage.objects.name || '%' AND can_access_company(n.company_id))));
