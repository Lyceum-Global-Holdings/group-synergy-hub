-- Fix warehouse tools not visible: Allow NULL company_id and remove warehouse role requirement

-- Update SELECT policy to be less restrictive
DROP POLICY IF EXISTS "Warehouse users can view warehouse tools" ON public.warehouse_tools;

CREATE POLICY "Authenticated users can view warehouse tools"
ON public.warehouse_tools FOR SELECT
USING (
  auth.uid() IS NOT NULL
  AND (company_id IS NULL OR can_access_company(company_id))
);

-- Backfill company_id from the creator's profile for legacy records
UPDATE warehouse_tools wt
SET company_id = p.company_id
FROM profiles p
WHERE wt.created_by = p.user_id
AND wt.company_id IS NULL
AND p.company_id IS NOT NULL;