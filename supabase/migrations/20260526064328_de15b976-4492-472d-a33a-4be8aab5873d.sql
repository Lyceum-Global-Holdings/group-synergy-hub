
-- Allow company members to update material issue notes during receiving flow
DROP POLICY IF EXISTS "Users can update their own draft material issues or admins can " ON public.material_issue_notes;

CREATE POLICY "Update material issue notes: draft creator, receiver, or admin"
ON public.material_issue_notes
FOR UPDATE
USING (
  is_admin((SELECT auth.uid()))
  OR ((SELECT auth.uid()) = created_by AND status = 'draft')
  OR (can_access_company(company_id) AND status IN ('issued','partially_received'))
);

-- Mirror on items so quantity_received updates succeed for receivers in the same company
DROP POLICY IF EXISTS "Users can manage items for their own material issues" ON public.material_issue_items;

CREATE POLICY "Insert/delete material issue items: draft creator or admin"
ON public.material_issue_items
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.material_issue_notes m
    WHERE m.id = material_issue_items.min_id
      AND (
        is_admin((SELECT auth.uid()))
        OR (m.created_by = (SELECT auth.uid()) AND m.status = 'draft')
      )
  )
);

CREATE POLICY "Delete material issue items: draft creator or admin"
ON public.material_issue_items
FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM public.material_issue_notes m
    WHERE m.id = material_issue_items.min_id
      AND (
        is_admin((SELECT auth.uid()))
        OR (m.created_by = (SELECT auth.uid()) AND m.status = 'draft')
      )
  )
);

CREATE POLICY "Update material issue items: draft creator, receiver, or admin"
ON public.material_issue_items
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.material_issue_notes m
    WHERE m.id = material_issue_items.min_id
      AND (
        is_admin((SELECT auth.uid()))
        OR (m.created_by = (SELECT auth.uid()) AND m.status = 'draft')
        OR (can_access_company(m.company_id) AND m.status IN ('issued','partially_received'))
      )
  )
);
