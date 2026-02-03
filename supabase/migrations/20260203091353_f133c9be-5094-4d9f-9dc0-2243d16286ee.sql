-- Fix asset_master table public exposure
-- Revoke all anonymous access

REVOKE ALL ON public.asset_master FROM anon;

-- Ensure only authenticated users can access
GRANT SELECT, INSERT, UPDATE, DELETE ON public.asset_master TO authenticated;

-- Force RLS for table owner
ALTER TABLE public.asset_master FORCE ROW LEVEL SECURITY;