
-- Drop the overly permissive policy
DROP POLICY "Authenticated users can manage location companies" ON public.warehouse_location_companies;

-- Create separate policies for insert, update, delete with proper checks
CREATE POLICY "Authenticated users can insert location companies"
  ON public.warehouse_location_companies
  FOR INSERT TO authenticated
  WITH CHECK (company_id IN (SELECT id FROM public.companies));

CREATE POLICY "Authenticated users can update location companies"
  ON public.warehouse_location_companies
  FOR UPDATE TO authenticated
  USING (company_id IN (SELECT id FROM public.companies));

CREATE POLICY "Authenticated users can delete location companies"
  ON public.warehouse_location_companies
  FOR DELETE TO authenticated
  USING (company_id IN (SELECT id FROM public.companies));
