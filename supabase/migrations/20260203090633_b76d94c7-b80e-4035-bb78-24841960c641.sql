-- Fix construction_labour_master table public exposure
-- Revoke all anonymous access

REVOKE ALL ON public.construction_labour_master FROM anon;

-- Ensure only authenticated users can access
GRANT SELECT, INSERT, UPDATE, DELETE ON public.construction_labour_master TO authenticated;

-- Force RLS for table owner
ALTER TABLE public.construction_labour_master FORCE ROW LEVEL SECURITY;