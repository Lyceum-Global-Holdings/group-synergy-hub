-- Fix construction_projects table public exposure
-- Revoke all anonymous access

REVOKE ALL ON public.construction_projects FROM anon;

-- Ensure only authenticated users can access
GRANT SELECT, INSERT, UPDATE, DELETE ON public.construction_projects TO authenticated;

-- Force RLS for table owner
ALTER TABLE public.construction_projects FORCE ROW LEVEL SECURITY;