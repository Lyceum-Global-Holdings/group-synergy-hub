-- Fix chart_of_accounts table public exposure
-- Revoke all anonymous access

REVOKE ALL ON public.chart_of_accounts FROM anon;

-- Ensure only authenticated users can access
GRANT SELECT, INSERT, UPDATE, DELETE ON public.chart_of_accounts TO authenticated;

-- Force RLS for table owner
ALTER TABLE public.chart_of_accounts FORCE ROW LEVEL SECURITY;