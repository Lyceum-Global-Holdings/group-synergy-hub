-- Fix sub-locations not showing: Remove warehouse access requirement for viewing
-- Any authenticated user in the same company should be able to see project allocations

DROP POLICY IF EXISTS "Warehouse users can view allocations" ON public.project_warehouse_allocations;

CREATE POLICY "Authenticated users can view project allocations"
ON public.project_warehouse_allocations FOR SELECT
USING (
  auth.uid() IS NOT NULL
  AND (company_id IS NULL OR can_access_company(company_id))
);