-- Fix purchase_orders table public exposure
-- Revoke all anonymous access

REVOKE ALL ON public.purchase_orders FROM anon;

-- Ensure only authenticated users can access
GRANT SELECT, INSERT, UPDATE, DELETE ON public.purchase_orders TO authenticated;

-- Force RLS for table owner
ALTER TABLE public.purchase_orders FORCE ROW LEVEL SECURITY;