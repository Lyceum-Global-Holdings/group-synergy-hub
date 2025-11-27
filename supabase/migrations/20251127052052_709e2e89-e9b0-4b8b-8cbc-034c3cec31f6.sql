-- Fix remaining 6 SECURITY DEFINER functions without search_path
-- This completes the security vulnerability fix for all functions

-- Company access and supplier functions
ALTER FUNCTION public.can_access_company(uuid) SET search_path = public;
ALTER FUNCTION public.get_company_approved_suppliers(uuid) SET search_path = public;

-- Material and stock management functions
ALTER FUNCTION public.process_material_issue_stock_update(uuid, numeric, uuid, uuid, text) SET search_path = public;
ALTER FUNCTION public.set_min_status_to_issued() SET search_path = public;
ALTER FUNCTION public.update_stock_on_grn_approval() SET search_path = public;
ALTER FUNCTION public.update_warehouse_stock_from_transaction() SET search_path = public;