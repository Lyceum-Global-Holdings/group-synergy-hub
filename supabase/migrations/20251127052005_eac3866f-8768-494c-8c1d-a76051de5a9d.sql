-- Fix security vulnerability: Add SET search_path to all SECURITY DEFINER functions
-- This prevents privilege escalation attacks by ensuring functions only use the public schema

-- Security-critical authentication and authorization functions
ALTER FUNCTION public.has_role(uuid, app_role) SET search_path = public;
ALTER FUNCTION public.is_admin(uuid) SET search_path = public;
ALTER FUNCTION public.is_super_admin(uuid) SET search_path = public;
ALTER FUNCTION public.is_company_hod(uuid, uuid) SET search_path = public;
ALTER FUNCTION public.is_company_manager(uuid, uuid) SET search_path = public;
ALTER FUNCTION public.has_po_approval_role(uuid, text) SET search_path = public;

-- Company helper functions
ALTER FUNCTION public.get_company_hod(uuid) SET search_path = public;
ALTER FUNCTION public.get_company_manager(uuid) SET search_path = public;
ALTER FUNCTION public.get_user_company_ids(uuid) SET search_path = public;
ALTER FUNCTION public.get_company_approvers(uuid, approval_level_type, text) SET search_path = public;

-- Number generation functions
ALTER FUNCTION public.generate_bom_number() SET search_path = public;
ALTER FUNCTION public.generate_grn_number() SET search_path = public;
ALTER FUNCTION public.generate_min_number() SET search_path = public;
ALTER FUNCTION public.generate_mrn_number() SET search_path = public;
ALTER FUNCTION public.generate_po_amendment_number() SET search_path = public;
ALTER FUNCTION public.generate_customer_code() SET search_path = public;
ALTER FUNCTION public.generate_asset_request_number() SET search_path = public;
ALTER FUNCTION public.generate_cpo_number() SET search_path = public;
ALTER FUNCTION public.generate_sales_order_number() SET search_path = public;
ALTER FUNCTION public.generate_pick_list_number() SET search_path = public;
ALTER FUNCTION public.generate_evaluation_number() SET search_path = public;
ALTER FUNCTION public.generate_mr_number() SET search_path = public;
ALTER FUNCTION public.generate_rfq_number() SET search_path = public;
ALTER FUNCTION public.generate_rfp_number() SET search_path = public;
ALTER FUNCTION public.generate_quote_number() SET search_path = public;
ALTER FUNCTION public.generate_putaway_number() SET search_path = public;
ALTER FUNCTION public.generate_transfer_number() SET search_path = public;
ALTER FUNCTION public.generate_cycle_count_number() SET search_path = public;
ALTER FUNCTION public.generate_issue_number() SET search_path = public;
ALTER FUNCTION public.generate_do_number() SET search_path = public;
ALTER FUNCTION public.generate_bpo_number() SET search_path = public;
ALTER FUNCTION public.generate_release_number() SET search_path = public;

-- Auto-generation trigger functions
ALTER FUNCTION public.auto_generate_grn_number() SET search_path = public;
ALTER FUNCTION public.auto_generate_customer_code() SET search_path = public;
ALTER FUNCTION public.auto_generate_cpo_number() SET search_path = public;
ALTER FUNCTION public.auto_generate_asset_request_number() SET search_path = public;
ALTER FUNCTION public.auto_generate_sales_order_number() SET search_path = public;
ALTER FUNCTION public.auto_generate_pick_list_number() SET search_path = public;
ALTER FUNCTION public.auto_generate_evaluation_number() SET search_path = public;
ALTER FUNCTION public.auto_generate_mr_number() SET search_path = public;
ALTER FUNCTION public.auto_generate_bom_number() SET search_path = public;
ALTER FUNCTION public.auto_generate_rfq_rfp_number() SET search_path = public;
ALTER FUNCTION public.auto_generate_quote_number() SET search_path = public;
ALTER FUNCTION public.auto_generate_putaway_number() SET search_path = public;
ALTER FUNCTION public.auto_generate_transfer_number() SET search_path = public;
ALTER FUNCTION public.auto_generate_cycle_count_number() SET search_path = public;
ALTER FUNCTION public.auto_generate_issue_number() SET search_path = public;
ALTER FUNCTION public.auto_generate_do_number() SET search_path = public;

-- Update and calculation functions
ALTER FUNCTION public.update_finished_goods_stock() SET search_path = public;
ALTER FUNCTION public.update_item_stock() SET search_path = public;
ALTER FUNCTION public.create_cpo_workflow_tracking() SET search_path = public;
ALTER FUNCTION public.create_default_gl_settings() SET search_path = public;
ALTER FUNCTION public.update_cpo_workflow_tracking() SET search_path = public;
ALTER FUNCTION public.update_cpo_total_amount() SET search_path = public;
ALTER FUNCTION public.update_grn_total_value() SET search_path = public;
ALTER FUNCTION public.calculate_supplier_analytics(uuid, integer) SET search_path = public;
ALTER FUNCTION public.calculate_evaluation_entry_scores() SET search_path = public;
ALTER FUNCTION public.update_supplier_evaluation_totals() SET search_path = public;
ALTER FUNCTION public.update_stock_on_batch_approval() SET search_path = public;
ALTER FUNCTION public.update_po_status_on_items_complete() SET search_path = public;
ALTER FUNCTION public.calculate_depreciation(numeric, date, text, numeric, integer, numeric, date) SET search_path = public;
ALTER FUNCTION public.update_asset_master_current_value() SET search_path = public;
ALTER FUNCTION public.update_warehouse_asset_current_value() SET search_path = public;
ALTER FUNCTION public.create_default_approval_stages() SET search_path = public;
ALTER FUNCTION public.update_so_item_on_pick() SET search_path = public;
ALTER FUNCTION public.update_so_on_do_creation() SET search_path = public;
ALTER FUNCTION public.update_stock_on_fg_issue() SET search_path = public;
ALTER FUNCTION public.sync_finished_goods_sizes() SET search_path = public;
ALTER FUNCTION public.update_pr_total_amount() SET search_path = public;
ALTER FUNCTION public.update_asset_request_total() SET search_path = public;
ALTER FUNCTION public.update_quote_total() SET search_path = public;
ALTER FUNCTION public.update_cycle_count_summary() SET search_path = public;
ALTER FUNCTION public.log_risk_flag_change() SET search_path = public;
ALTER FUNCTION public.update_supplier_on_blacklist() SET search_path = public;
ALTER FUNCTION public.schedule_next_blacklist_review() SET search_path = public;
ALTER FUNCTION public.calculate_supplier_risk_score(uuid) SET search_path = public;
ALTER FUNCTION public.calculate_cycle_count_variance() SET search_path = public;

-- Duplicate checking and validation functions
ALTER FUNCTION public.check_duplicate_supplier(text, text, text, text) SET search_path = public;
ALTER FUNCTION public.calculate_kpi_value(uuid) SET search_path = public;
ALTER FUNCTION public.calculate_bpo_remaining_value(uuid) SET search_path = public;