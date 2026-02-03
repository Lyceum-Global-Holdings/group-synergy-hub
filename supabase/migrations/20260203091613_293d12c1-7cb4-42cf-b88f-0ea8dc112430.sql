-- Fix bill_of_materials table public exposure
-- Revoke all anonymous access

REVOKE ALL ON public.bill_of_materials FROM anon;

-- Ensure only authenticated users can access
GRANT SELECT, INSERT, UPDATE, DELETE ON public.bill_of_materials TO authenticated;

-- Force RLS for table owner
ALTER TABLE public.bill_of_materials FORCE ROW LEVEL SECURITY;