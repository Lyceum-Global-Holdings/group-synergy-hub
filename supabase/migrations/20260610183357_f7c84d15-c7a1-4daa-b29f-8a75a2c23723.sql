
CREATE OR REPLACE FUNCTION public.is_admin_or_higher(_user uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles ur
    JOIN public.roles r ON r.id = ur.role_id
    WHERE ur.user_id = _user
      AND (r.app_role IN ('admin','super_admin') OR r.name IN ('admin','super_admin'))
  )
$$;

GRANT EXECUTE ON FUNCTION public.is_admin_or_higher(uuid) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.enforce_grn_admin_approval()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status
     AND NEW.status IN ('approved','completed')
     AND NOT public.is_admin_or_higher(auth.uid()) THEN
    RAISE EXCEPTION 'Only admins can approve GRN' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_grn_admin_approval ON public.goods_receipt_notes;
CREATE TRIGGER trg_enforce_grn_admin_approval
  BEFORE UPDATE ON public.goods_receipt_notes
  FOR EACH ROW EXECUTE FUNCTION public.enforce_grn_admin_approval();

CREATE OR REPLACE FUNCTION public.enforce_mrn_admin_approval()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status
     AND NEW.status IN ('returned','approved')
     AND NOT public.is_admin_or_higher(auth.uid()) THEN
    RAISE EXCEPTION 'Only admins can approve material returns' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_mrn_admin_approval ON public.material_return_notes;
CREATE TRIGGER trg_enforce_mrn_admin_approval
  BEFORE UPDATE ON public.material_return_notes
  FOR EACH ROW EXECUTE FUNCTION public.enforce_mrn_admin_approval();

CREATE OR REPLACE FUNCTION public.enforce_min_admin_approval()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF (
        (NEW.hod_approved_by IS NOT NULL AND NEW.hod_approved_by IS DISTINCT FROM OLD.hod_approved_by)
     OR (NEW.management_approved_by IS NOT NULL AND NEW.management_approved_by IS DISTINCT FROM OLD.management_approved_by)
     OR (NEW.status IS DISTINCT FROM OLD.status AND NEW.status = 'approved')
     )
     AND NOT public.is_admin_or_higher(auth.uid()) THEN
    RAISE EXCEPTION 'Only admins can approve material issues' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_min_admin_approval ON public.material_issue_notes;
CREATE TRIGGER trg_enforce_min_admin_approval
  BEFORE UPDATE ON public.material_issue_notes
  FOR EACH ROW EXECUTE FUNCTION public.enforce_min_admin_approval();
