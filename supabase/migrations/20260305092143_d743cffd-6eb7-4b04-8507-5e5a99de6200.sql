-- Resolve security-definer view lint while preserving existing view column types.

CREATE OR REPLACE FUNCTION public.get_construction_labour_directory()
RETURNS TABLE (
  id uuid,
  company_id uuid,
  name text,
  trade text,
  skill_level text,
  category text,
  labour_company text,
  contact_number text,
  email text,
  epf_no text,
  employee_id text,
  hourly_rate numeric,
  daily_rate numeric,
  status text,
  notes text,
  project_id uuid,
  location_id uuid,
  created_by uuid,
  created_at timestamptz,
  updated_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
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
$$;

CREATE OR REPLACE VIEW public.construction_labour_directory
WITH (security_invoker=on) AS
SELECT
  d.id,
  d.company_id,
  d.name,
  d.trade,
  d.skill_level,
  d.category,
  d.labour_company,
  d.contact_number,
  d.email,
  d.epf_no,
  d.employee_id,
  d.hourly_rate::numeric(10,2) AS hourly_rate,
  d.daily_rate::numeric(10,2) AS daily_rate,
  d.status,
  d.notes,
  d.project_id,
  d.location_id,
  d.created_by,
  d.created_at,
  d.updated_at
FROM public.get_construction_labour_directory() d;

GRANT EXECUTE ON FUNCTION public.get_construction_labour_directory() TO authenticated;
GRANT SELECT ON public.construction_labour_directory TO authenticated;