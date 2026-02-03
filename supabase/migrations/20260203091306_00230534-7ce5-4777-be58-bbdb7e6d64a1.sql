-- Fix contracts table public exposure
-- Revoke all anonymous access

REVOKE ALL ON public.contracts FROM anon;

-- Ensure only authenticated users can access
GRANT SELECT, INSERT, UPDATE, DELETE ON public.contracts TO authenticated;

-- Force RLS for table owner
ALTER TABLE public.contracts FORCE ROW LEVEL SECURITY;