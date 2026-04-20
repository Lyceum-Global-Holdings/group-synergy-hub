DROP POLICY IF EXISTS "Authenticated users can read location companies" ON public.warehouse_location_companies;
DROP POLICY IF EXISTS "Authenticated users can insert location companies" ON public.warehouse_location_companies;
DROP POLICY IF EXISTS "Authenticated users can update location companies" ON public.warehouse_location_companies;
DROP POLICY IF EXISTS "Authenticated users can delete location companies" ON public.warehouse_location_companies;

CREATE POLICY "Select location companies by company"
ON public.warehouse_location_companies
FOR SELECT
TO authenticated
USING (public.can_access_company(company_id));

CREATE POLICY "Insert location companies by company"
ON public.warehouse_location_companies
FOR INSERT
TO authenticated
WITH CHECK (public.can_access_company(company_id));

CREATE POLICY "Update location companies by company"
ON public.warehouse_location_companies
FOR UPDATE
TO authenticated
USING (public.can_access_company(company_id))
WITH CHECK (public.can_access_company(company_id));

CREATE POLICY "Delete location companies by company"
ON public.warehouse_location_companies
FOR DELETE
TO authenticated
USING (public.can_access_company(company_id));