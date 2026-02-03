-- Fix bank_accounts table public exposure
-- Revoke all anonymous access

REVOKE ALL ON public.bank_accounts FROM anon;

-- Ensure only authenticated users can access
GRANT SELECT, INSERT, UPDATE, DELETE ON public.bank_accounts TO authenticated;

-- Force RLS for table owner
ALTER TABLE public.bank_accounts FORCE ROW LEVEL SECURITY;