-- Fix warehouse_items table public exposure
-- Revoke all anonymous access

REVOKE ALL ON public.warehouse_items FROM anon;

-- Ensure only authenticated users can access
GRANT SELECT, INSERT, UPDATE, DELETE ON public.warehouse_items TO authenticated;

-- Force RLS for table owner
ALTER TABLE public.warehouse_items FORCE ROW LEVEL SECURITY;