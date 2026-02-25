-- 1) Access helper: determine whether current user can manage attendance for a given report
CREATE OR REPLACE FUNCTION public.can_manage_site_report_attendance(_site_report_id uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid uuid;
  _company_id uuid;
BEGIN
  _uid := auth.uid();
  IF _uid IS NULL THEN
    RETURN false;
  END IF;

  SELECT dsr.company_id
  INTO _company_id
  FROM public.daily_site_reports dsr
  WHERE dsr.id = _site_report_id;

  IF _company_id IS NULL THEN
    RETURN false;
  END IF;

  RETURN public.is_super_admin(_uid) OR public.can_access_company(_company_id);
END;
$$;

-- 2) Trigger function: enforce company_id + created_by from source report/auth context
CREATE OR REPLACE FUNCTION public.set_site_report_labour_attendance_context()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _report_company_id uuid;
BEGIN
  SELECT dsr.company_id
  INTO _report_company_id
  FROM public.daily_site_reports dsr
  WHERE dsr.id = NEW.site_report_id;

  IF _report_company_id IS NULL THEN
    RAISE EXCEPTION 'Invalid site_report_id for labour attendance: %', NEW.site_report_id;
  END IF;

  NEW.company_id := _report_company_id;

  IF NEW.created_by IS NULL THEN
    NEW.created_by := auth.uid();
  END IF;

  NEW.updated_at := now();
  IF TG_OP = 'INSERT' AND NEW.created_at IS NULL THEN
    NEW.created_at := now();
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_site_report_labour_attendance_set_context
ON public.site_report_labour_attendance;

CREATE TRIGGER trg_site_report_labour_attendance_set_context
BEFORE INSERT OR UPDATE OF site_report_id, company_id, created_by
ON public.site_report_labour_attendance
FOR EACH ROW
EXECUTE FUNCTION public.set_site_report_labour_attendance_context();

-- 3) Data hygiene: align historical rows to report company
UPDATE public.site_report_labour_attendance a
SET
  company_id = dsr.company_id,
  updated_at = now()
FROM public.daily_site_reports dsr
WHERE dsr.id = a.site_report_id
  AND a.company_id IS DISTINCT FROM dsr.company_id;

UPDATE public.site_report_labour_attendance
SET created_by = auth.uid()
WHERE created_by IS NULL
  AND auth.uid() IS NOT NULL;

-- 4) Harden RLS policies to rely on report access instead of client-supplied company_id
DROP POLICY IF EXISTS "Authenticated users can create attendance for their company"
ON public.site_report_labour_attendance;

DROP POLICY IF EXISTS "Authenticated users can view attendance for their company"
ON public.site_report_labour_attendance;

DROP POLICY IF EXISTS "Users can update attendance for their company"
ON public.site_report_labour_attendance;

DROP POLICY IF EXISTS "Users can delete attendance for their company"
ON public.site_report_labour_attendance;

CREATE POLICY "Authenticated users can view attendance for their company"
ON public.site_report_labour_attendance
FOR SELECT
TO authenticated
USING (public.can_manage_site_report_attendance(site_report_id));

CREATE POLICY "Authenticated users can create attendance for their company"
ON public.site_report_labour_attendance
FOR INSERT
TO authenticated
WITH CHECK (
  public.can_manage_site_report_attendance(site_report_id)
  AND created_by = auth.uid()
  AND company_id = (
    SELECT dsr.company_id
    FROM public.daily_site_reports dsr
    WHERE dsr.id = site_report_labour_attendance.site_report_id
  )
);

CREATE POLICY "Users can update attendance for their company"
ON public.site_report_labour_attendance
FOR UPDATE
TO authenticated
USING (public.can_manage_site_report_attendance(site_report_id))
WITH CHECK (public.can_manage_site_report_attendance(site_report_id));

CREATE POLICY "Users can delete attendance for their company"
ON public.site_report_labour_attendance
FOR DELETE
TO authenticated
USING (public.can_manage_site_report_attendance(site_report_id));