-- Fix supplier_invoices table public exposure
-- Revoke all anonymous access

REVOKE ALL ON public.supplier_invoices FROM anon;

-- Ensure only authenticated users can access
GRANT SELECT, INSERT, UPDATE, DELETE ON public.supplier_invoices TO authenticated;

-- Force RLS for table owner
ALTER TABLE public.supplier_invoices FORCE ROW LEVEL SECURITY;