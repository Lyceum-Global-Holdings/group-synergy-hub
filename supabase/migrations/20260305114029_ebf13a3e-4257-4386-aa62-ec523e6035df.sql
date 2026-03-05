
-- Drop old profile-based RLS policies on construction_projects
DROP POLICY IF EXISTS "Users can view projects in their company" ON public.construction_projects;
DROP POLICY IF EXISTS "Users can create projects in their company" ON public.construction_projects;
DROP POLICY IF EXISTS "Users can update projects in their company" ON public.construction_projects;
DROP POLICY IF EXISTS "Users can delete projects in their company" ON public.construction_projects;

-- New policies using can_access_company() for multi-company support
CREATE POLICY "Users can view construction projects"
  ON public.construction_projects
  FOR SELECT
  TO authenticated
  USING (public.can_access_company(company_id));

CREATE POLICY "Construction users can create projects"
  ON public.construction_projects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    public.can_access_company(company_id)
    AND public.has_construction_access(auth.uid())
  );

CREATE POLICY "Construction users can update projects"
  ON public.construction_projects
  FOR UPDATE
  TO authenticated
  USING (
    public.can_access_company(company_id)
    AND public.has_construction_access(auth.uid())
  );

CREATE POLICY "Only admins can delete construction projects"
  ON public.construction_projects
  FOR DELETE
  TO authenticated
  USING (
    public.can_access_company(company_id)
    AND (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin'))
  );
