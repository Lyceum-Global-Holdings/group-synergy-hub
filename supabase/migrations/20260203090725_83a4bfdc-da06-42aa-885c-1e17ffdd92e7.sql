-- Fix customers table public exposure
-- Revoke all anonymous access

REVOKE ALL ON public.customers FROM anon;

-- Ensure only authenticated users can access
GRANT SELECT, INSERT, UPDATE, DELETE ON public.customers TO authenticated;

-- Force RLS for table owner
ALTER TABLE public.customers FORCE ROW LEVEL SECURITY;