
DROP POLICY IF EXISTS "Update material issue notes: draft creator, receiver, or admin" ON public.material_issue_notes;

CREATE POLICY "Update material issue notes: draft creator, receiver, or admin"
ON public.material_issue_notes
FOR UPDATE
USING (
  is_admin((SELECT auth.uid()))
  OR ((SELECT auth.uid()) = created_by AND status = 'draft')
  OR (can_access_company(company_id) AND status IN ('issued','partially_received','completed'))
);
