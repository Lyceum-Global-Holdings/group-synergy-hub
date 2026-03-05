-- Fix labour allocation visibility for non-HR users by making the directory view run with definer privileges
-- while preserving explicit row filtering by company and module/role access.
CREATE OR REPLACE VIEW public.construction_labour_directory
WITH (security_invoker=off) AS
SELECT
  clm.id,
  clm.company_id,
  clm.name,
  clm.trade,
  clm.skill_level,
  clm.category,
  clm.labour_company,
  CASE
    WHEN public.has_hr_access(auth.uid()) OR public.is_admin(auth.uid()) THEN clm.contact_number
    ELSE NULL::text
  END AS contact_number,
  CASE
    WHEN public.has_hr_access(auth.uid()) OR public.is_admin(auth.uid()) THEN clm.email
    ELSE NULL::text
  END AS email,
  CASE
    WHEN public.has_hr_access(auth.uid()) OR public.is_admin(auth.uid()) THEN clm.epf_no
    WHEN clm.epf_no IS NOT NULL THEN '****'::text || right(clm.epf_no, 4)
    ELSE NULL::text
  END AS epf_no,
  CASE
    WHEN public.has_hr_access(auth.uid()) OR public.is_admin(auth.uid()) THEN clm.employee_id
    WHEN clm.employee_id IS NOT NULL THEN '***'::text || right(clm.employee_id, 3)
    ELSE NULL::text
  END AS employee_id,
  clm.hourly_rate,
  clm.daily_rate,
  clm.status,
  clm.notes,
  clm.project_id,
  clm.location_id,
  clm.created_by,
  clm.created_at,
  clm.updated_at
FROM public.construction_labour_master clm
WHERE
  public.is_admin(auth.uid())
  OR (
    public.can_access_company(clm.company_id)
    AND (
      public.has_hr_access(auth.uid())
      OR public.has_construction_access(auth.uid())
      OR public.has_manager_access(auth.uid())
    )
  );

GRANT SELECT ON public.construction_labour_directory TO authenticated;