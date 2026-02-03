-- Fix currencies RLS - make it properly restricted
DROP POLICY IF EXISTS "Admins can manage currencies" ON public.currencies;

CREATE POLICY "No direct currency inserts"
ON public.currencies FOR INSERT TO authenticated
WITH CHECK (false);

CREATE POLICY "No direct currency updates"  
ON public.currencies FOR UPDATE TO authenticated
USING (false);

CREATE POLICY "No direct currency deletes"
ON public.currencies FOR DELETE TO authenticated
USING (false);