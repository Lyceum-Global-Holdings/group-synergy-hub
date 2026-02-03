-- Fix sales_orders table public exposure
-- Revoke all anonymous access

REVOKE ALL ON public.sales_orders FROM anon;

-- Ensure only authenticated users can access
GRANT SELECT, INSERT, UPDATE, DELETE ON public.sales_orders TO authenticated;

-- Force RLS for table owner
ALTER TABLE public.sales_orders FORCE ROW LEVEL SECURITY;