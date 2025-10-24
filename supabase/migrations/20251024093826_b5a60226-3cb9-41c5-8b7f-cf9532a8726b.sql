-- Fix security definer views by converting them to SECURITY INVOKER
-- This ensures views use the permissions of the querying user, not the view creator

-- Convert all public schema views to SECURITY INVOKER
ALTER VIEW public.modern_boms SET (security_invoker = true);
ALTER VIEW public.v_active_accounts_with_balances SET (security_invoker = true);
ALTER VIEW public.v_adjustment_summary_by_item SET (security_invoker = true);
ALTER VIEW public.v_adjustment_trends SET (security_invoker = true);

-- Verify the change
COMMENT ON VIEW public.modern_boms IS 'View with SECURITY INVOKER - enforces querying user permissions';
COMMENT ON VIEW public.v_active_accounts_with_balances IS 'View with SECURITY INVOKER - enforces querying user permissions';
COMMENT ON VIEW public.v_adjustment_summary_by_item IS 'View with SECURITY INVOKER - enforces querying user permissions';
COMMENT ON VIEW public.v_adjustment_trends IS 'View with SECURITY INVOKER - enforces querying user permissions';