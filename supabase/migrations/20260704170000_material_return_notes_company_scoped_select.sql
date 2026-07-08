-- Fix: 'user' role accounts could not see material return notes.
--
-- In June 2026 the material_return_notes SELECT policy was changed to be
-- location-scoped: a non-admin could only see a note if they had an explicit
-- row in user_location_assignments for that note's location (and the previous
-- "location_id IS NULL → visible" fallback was removed). material_issue_notes,
-- however, stayed company-scoped. The result: users without a per-location
-- assignment saw zero returns, while seeing issues fine — an inconsistent,
-- hard-to-administer split.
--
-- This restores company-scoped visibility for return notes, matching
-- material_issue_notes: anyone who can access the company sees its return notes.
-- (INSERT/UPDATE policies are left untouched, so write access stays as-is.)

DROP POLICY IF EXISTS "Users can view material return notes scoped by location" ON public.material_return_notes;
DROP POLICY IF EXISTS "Users can view material return notes in their company" ON public.material_return_notes;

CREATE POLICY "Users can view material return notes in their company"
ON public.material_return_notes
FOR SELECT
USING (public.can_access_company(company_id));
