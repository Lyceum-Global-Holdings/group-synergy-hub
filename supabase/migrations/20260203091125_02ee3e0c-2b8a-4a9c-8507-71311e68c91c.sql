-- Fix suppliers table public exposure
-- Revoke all anonymous access

REVOKE ALL ON public.suppliers FROM anon;

-- Ensure only authenticated users can access
GRANT SELECT, INSERT, UPDATE, DELETE ON public.suppliers TO authenticated;

-- Force RLS for table owner
ALTER TABLE public.suppliers FORCE ROW LEVEL SECURITY;