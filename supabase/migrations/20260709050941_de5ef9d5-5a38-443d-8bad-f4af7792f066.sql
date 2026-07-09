DROP POLICY IF EXISTS "Users can view material return notes scoped by location" ON public.material_return_notes;

CREATE POLICY "Users can view material return notes in their company"
  ON public.material_return_notes
  FOR SELECT
  USING (can_access_company(company_id));