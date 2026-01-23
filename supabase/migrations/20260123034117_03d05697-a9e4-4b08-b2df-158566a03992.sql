-- Fix sub-locations not showing when decreasing stock
-- Update RLS policy to allow records with NULL company_id (legacy/shared data)

DROP POLICY IF EXISTS "Warehouse users can view allocations" ON public.project_warehouse_allocations;

CREATE POLICY "Warehouse users can view allocations"
ON public.project_warehouse_allocations FOR SELECT
USING (
  (company_id IS NULL OR can_access_company(company_id)) 
  AND has_warehouse_access(auth.uid())
);

-- Backfill company_id from construction_projects for existing allocations
UPDATE project_warehouse_allocations pwa
SET company_id = cp.company_id
FROM construction_projects cp
WHERE pwa.project_id = cp.id
AND pwa.company_id IS NULL;