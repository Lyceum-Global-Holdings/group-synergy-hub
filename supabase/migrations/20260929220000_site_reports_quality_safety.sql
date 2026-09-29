-- Construction: site reports are submitted and approved; quality and safety
-- records follow a workflow with corrective actions.
--
-- 1. Daily site reports: draft → submitted → approved, or returned for changes
--    (with a reason). The project's manager, or a construction manager or admin
--    of the company, decides — never the person who submitted it. Submitted and
--    approved reports can't be edited or deleted. They appear in the Approval
--    Console.
-- 2. Corrective actions: one register for quality inspections, safety incidents
--    and safety inspections. Each action has an owner and a due date; the owner
--    marks it done and a manager verifies it (or sends it back). Verifications
--    appear in the Approval Console.
-- 3. Quality inspections: scheduled → in progress → completed (pass, or
--    conditional pass with actions) or failed (findings and actions required).
--    A failed inspection is re-inspected once its actions are done.
-- 4. Safety incidents: reported → investigating → closed. Closing needs the
--    root cause, at least one action and no action still open; serious
--    incidents (high/critical, lost time, fatality) are closed by a manager.
-- 5. Safety inspections: scheduled → completed with a score; hazards found
--    need actions, and the follow-up date tracks the open actions.
-- 6. The site report's materials view can be limited to the project's
--    warehouses (project_location_ids).
--
-- Status and result changes go through these functions; the screens can still
-- edit the descriptive fields while a record is open. Safe to run more than once.

-- ─────────────────────────────────────────────────────────────────────────────
-- 0. Shared helpers
-- ─────────────────────────────────────────────────────────────────────────────
-- Active users of a company (for pickers).
CREATE OR REPLACE FUNCTION public.company_user_directory(p_company_id uuid)
RETURNS TABLE (user_id uuid, full_name text, email text)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NOT public.can_access_company(p_company_id) THEN
    RAISE EXCEPTION 'Not allowed' USING ERRCODE = '42501';
  END IF;
  RETURN QUERY
  SELECT p.user_id, p.full_name, p.email
    FROM public.profiles p
   WHERE p.deactivated_at IS NULL
     AND (p.company_id = p_company_id
          OR EXISTS (SELECT 1 FROM public.user_company_access a
                      WHERE a.user_id = p.user_id AND a.company_id = p_company_id))
   ORDER BY p.full_name NULLS LAST, p.email;
END;
$$;

CREATE OR REPLACE FUNCTION public.is_project_manager(p_user_id uuid, p_project_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.construction_projects WHERE id = p_project_id AND project_manager_id = p_user_id)
      OR EXISTS (SELECT 1 FROM public.project_team_members
                  WHERE project_id = p_project_id AND user_id = p_user_id AND role = 'project_manager'
                    AND COALESCE(is_active, true) AND (end_date IS NULL OR end_date >= CURRENT_DATE))
$$;

-- Records quality and safety work: construction or HR (HSE) users of the company.
CREATE OR REPLACE FUNCTION public.can_record_qhse(p_company_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT auth.uid() IS NOT NULL
     AND public.can_access_company(p_company_id)
     AND (public.is_admin(auth.uid()) OR public.has_construction_access(auth.uid()) OR public.has_hr_access(auth.uid()))
$$;

-- Decides (approves, verifies, closes serious incidents): admin, the project's
-- manager, or a manager with construction or HR access.
CREATE OR REPLACE FUNCTION public.can_decide_construction(p_company_id uuid, p_project_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT auth.uid() IS NOT NULL
     AND public.can_access_company(p_company_id)
     AND (public.is_admin(auth.uid())
          OR public.is_project_manager(auth.uid(), p_project_id)
          OR (public.has_manager_access(auth.uid())
              AND (public.has_construction_access(auth.uid()) OR public.has_hr_access(auth.uid()))))
$$;

-- The project's warehouses and everything under them (site report materials view).
CREATE OR REPLACE FUNCTION public.project_location_ids(p_project_id uuid)
RETURNS SETOF uuid
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NOT public.can_access_company((SELECT company_id FROM public.construction_projects WHERE id = p_project_id)) THEN
    RETURN;
  END IF;
  RETURN QUERY
  WITH RECURSIVE t AS (
    SELECT l.id FROM public.warehouse_locations l WHERE l.id IN (SELECT public.project_warehouse_ids(p_project_id))
    UNION
    SELECT l.id FROM public.warehouse_locations l JOIN t ON l.parent_id = t.id
  )
  SELECT id FROM t;
END;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. Daily site reports
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.daily_site_reports
  ADD COLUMN IF NOT EXISTS submitted_at timestamptz,
  ADD COLUMN IF NOT EXISTS approved_at timestamptz,
  ADD COLUMN IF NOT EXISTS reviewed_by uuid,
  ADD COLUMN IF NOT EXISTS reviewed_at timestamptz,
  ADD COLUMN IF NOT EXISTS review_note text;

UPDATE public.daily_site_reports SET status = 'draft'
 WHERE status IS NULL OR status NOT IN ('draft', 'submitted', 'approved', 'returned');
ALTER TABLE public.daily_site_reports ALTER COLUMN status SET DEFAULT 'draft';
ALTER TABLE public.daily_site_reports ALTER COLUMN status SET NOT NULL;
ALTER TABLE public.daily_site_reports DROP CONSTRAINT IF EXISTS daily_site_reports_status_check;
ALTER TABLE public.daily_site_reports
  ADD CONSTRAINT daily_site_reports_status_check CHECK (status IN ('draft', 'submitted', 'approved', 'returned'));

-- New reports must belong to a company the user can access (any signed-in user could insert).
DROP POLICY IF EXISTS "Authenticated users can create daily reports" ON public.daily_site_reports;
CREATE POLICY "Authenticated users can create daily reports" ON public.daily_site_reports
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL AND public.can_access_company(company_id));

CREATE OR REPLACE FUNCTION public.site_report_block_reason(p_report_id uuid)
RETURNS text
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  r public.daily_site_reports%ROWTYPE;
BEGIN
  SELECT * INTO r FROM public.daily_site_reports WHERE id = p_report_id;
  IF NOT FOUND THEN RETURN 'Report not found'; END IF;
  IF r.status <> 'submitted' THEN RETURN 'This report isn''t waiting for approval'; END IF;
  IF NOT public.can_decide_construction(r.company_id, r.project_id) THEN
    RETURN 'Only the project manager, a construction manager or an admin can approve site reports';
  END IF;
  IF r.submitted_by = auth.uid() THEN RETURN 'You submitted this report, so someone else must approve it'; END IF;
  RETURN NULL;
END;
$$;

CREATE OR REPLACE FUNCTION public.submit_site_report(p_report_id uuid)
RETURNS text
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  r public.daily_site_reports%ROWTYPE;
BEGIN
  SELECT * INTO r FROM public.daily_site_reports WHERE id = p_report_id FOR UPDATE;
  IF NOT FOUND OR NOT public.can_access_company(r.company_id)
     OR NOT (public.is_admin(auth.uid()) OR public.has_construction_access(auth.uid())) THEN
    RAISE EXCEPTION 'Only construction users of this company can submit site reports' USING ERRCODE = '42501';
  END IF;
  IF r.status NOT IN ('draft', 'returned') THEN
    RAISE EXCEPTION 'This report is already %', r.status;
  END IF;
  IF r.report_type::text = 'daily' AND NULLIF(btrim(COALESCE(r.work_summary, '')), '') IS NULL THEN
    RAISE EXCEPTION 'Describe the work done before submitting';
  END IF;
  UPDATE public.daily_site_reports
     SET status = 'submitted', submitted_by = auth.uid(), submitted_at = now(), updated_at = now()
   WHERE id = p_report_id;
  RETURN 'submitted';
END;
$$;

CREATE OR REPLACE FUNCTION public.decide_site_report(p_report_id uuid, p_approve boolean, p_note text DEFAULT NULL)
RETURNS text
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_reason text;
  v_note text := NULLIF(btrim(COALESCE(p_note, '')), '');
BEGIN
  PERFORM 1 FROM public.daily_site_reports WHERE id = p_report_id FOR UPDATE;
  v_reason := public.site_report_block_reason(p_report_id);
  IF v_reason IS NOT NULL THEN RAISE EXCEPTION '%', v_reason USING ERRCODE = '42501'; END IF;
  IF NOT p_approve AND v_note IS NULL THEN RAISE EXCEPTION 'Say what needs changing'; END IF;

  UPDATE public.daily_site_reports
     SET status = CASE WHEN p_approve THEN 'approved' ELSE 'returned' END,
         approved_by = CASE WHEN p_approve THEN auth.uid() END,
         approved_at = CASE WHEN p_approve THEN now() END,
         reviewed_by = auth.uid(), reviewed_at = now(), review_note = v_note, updated_at = now()
   WHERE id = p_report_id;
  RETURN CASE WHEN p_approve THEN 'approved' ELSE 'returned' END;
END;
$$;

-- Status moves only through submit/decide; submitted and approved reports are frozen.
CREATE OR REPLACE FUNCTION public.guard_site_report()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF current_user NOT IN ('authenticated', 'anon') THEN
    RETURN COALESCE(NEW, OLD);
  END IF;
  IF TG_OP = 'INSERT' THEN
    IF NEW.status <> 'draft' THEN RAISE EXCEPTION 'New site reports start as drafts'; END IF;
    NEW.approved_by := NULL; NEW.approved_at := NULL; NEW.submitted_at := NULL;
    NEW.reviewed_by := NULL; NEW.reviewed_at := NULL; NEW.review_note := NULL;
    RETURN NEW;
  END IF;
  IF OLD.status IN ('submitted', 'approved') THEN
    RAISE EXCEPTION 'This report is %, so it can''t be changed', OLD.status;
  END IF;
  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  IF NEW.status IS DISTINCT FROM OLD.status
     OR NEW.approved_by IS DISTINCT FROM OLD.approved_by OR NEW.approved_at IS DISTINCT FROM OLD.approved_at
     OR NEW.submitted_at IS DISTINCT FROM OLD.submitted_at OR NEW.reviewed_by IS DISTINCT FROM OLD.reviewed_by
     OR NEW.reviewed_at IS DISTINCT FROM OLD.reviewed_at OR NEW.review_note IS DISTINCT FROM OLD.review_note THEN
    RAISE EXCEPTION 'Use Submit, Approve or Return to change a report''s status';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_site_report ON public.daily_site_reports;
CREATE TRIGGER trg_guard_site_report
  BEFORE INSERT OR UPDATE OR DELETE ON public.daily_site_reports
  FOR EACH ROW EXECUTE FUNCTION public.guard_site_report();

-- Attendance on a submitted or approved report is frozen too.
CREATE OR REPLACE FUNCTION public.guard_site_report_attendance()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_status text;
BEGIN
  IF current_user NOT IN ('authenticated', 'anon') THEN
    RETURN COALESCE(NEW, OLD);
  END IF;
  SELECT status INTO v_status FROM public.daily_site_reports WHERE id = COALESCE(NEW.site_report_id, OLD.site_report_id);
  IF v_status IN ('submitted', 'approved') THEN
    RAISE EXCEPTION 'This report is %, so its attendance can''t be changed', v_status;
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_site_report_attendance ON public.site_report_labour_attendance;
CREATE TRIGGER trg_guard_site_report_attendance
  BEFORE INSERT OR UPDATE OR DELETE ON public.site_report_labour_attendance
  FOR EACH ROW EXECUTE FUNCTION public.guard_site_report_attendance();

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. Corrective actions
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.construction_corrective_actions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  action_number text,
  company_id uuid REFERENCES public.companies(id) ON DELETE CASCADE,
  project_id uuid REFERENCES public.construction_projects(id) ON DELETE CASCADE,
  source_type text NOT NULL CHECK (source_type IN ('quality_inspection', 'safety_incident', 'safety_inspection')),
  source_id uuid NOT NULL,
  action_type text NOT NULL DEFAULT 'corrective' CHECK (action_type IN ('corrective', 'preventive')),
  description text NOT NULL CHECK (btrim(description) <> ''),
  assigned_to uuid,
  due_date date,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'done', 'verified', 'cancelled')),
  completion_note text,
  completed_by uuid,
  completed_at timestamptz,
  verified_by uuid,
  verified_at timestamptz,
  verification_note text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_cca_source ON public.construction_corrective_actions (source_type, source_id);
CREATE INDEX IF NOT EXISTS idx_cca_company_status ON public.construction_corrective_actions (company_id, status);

ALTER TABLE public.construction_corrective_actions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Company users can view corrective actions" ON public.construction_corrective_actions;
CREATE POLICY "Company users can view corrective actions" ON public.construction_corrective_actions
  FOR SELECT TO authenticated USING (public.can_access_company(company_id));
-- No insert/update/delete policies: changes go through the functions below.

-- The source record's company, project and whether it still takes actions.
CREATE OR REPLACE FUNCTION public.qhse_source(p_source_type text, p_source_id uuid,
  OUT company_id uuid, OUT project_id uuid, OUT ref text, OUT open_for_actions boolean)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  CASE p_source_type
    WHEN 'quality_inspection' THEN
      SELECT q.company_id, q.project_id, q.inspection_number, q.status IN ('in_progress', 'completed', 'failed')
        INTO company_id, project_id, ref, open_for_actions FROM public.quality_inspections q WHERE q.id = p_source_id;
    WHEN 'safety_incident' THEN
      SELECT s.company_id, s.project_id, s.incident_number, s.status <> 'closed'
        INTO company_id, project_id, ref, open_for_actions FROM public.safety_incidents s WHERE s.id = p_source_id;
    WHEN 'safety_inspection' THEN
      SELECT s.company_id, s.project_id, s.inspection_number, s.status = 'completed'
        INTO company_id, project_id, ref, open_for_actions FROM public.safety_inspections s WHERE s.id = p_source_id;
    ELSE
      RAISE EXCEPTION 'Unknown record type %', p_source_type;
  END CASE;
  IF ref IS NULL AND company_id IS NULL AND project_id IS NULL THEN
    RAISE EXCEPTION 'Record not found';
  END IF;
END;
$$;

-- Internal: adds actions from a JSON list [{description, action_type?, assigned_to?, due_date?}].
CREATE OR REPLACE FUNCTION public.insert_corrective_actions(p_source_type text, p_source_id uuid, p_actions jsonb)
RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  src record;
  a jsonb;
  v_n integer := 0;
  v_base text;
  v_seq integer;
  v_user uuid;
BEGIN
  SELECT * INTO src FROM public.qhse_source(p_source_type, p_source_id);
  FOR a IN SELECT * FROM jsonb_array_elements(COALESCE(p_actions, '[]'::jsonb)) LOOP
    IF NULLIF(btrim(COALESCE(a->>'description', '')), '') IS NULL THEN
      RAISE EXCEPTION 'Each action needs a description';
    END IF;
    v_user := NULLIF(a->>'assigned_to', '')::uuid;
    IF v_user IS NOT NULL AND NOT EXISTS (
         SELECT 1 FROM public.profiles p
          WHERE p.user_id = v_user AND p.deactivated_at IS NULL
            AND (p.company_id = src.company_id
                 OR EXISTS (SELECT 1 FROM public.user_company_access x WHERE x.user_id = v_user AND x.company_id = src.company_id))) THEN
      RAISE EXCEPTION 'Assign actions to an active user of this company';
    END IF;
    IF NULLIF(a->>'due_date', '') IS NOT NULL AND (a->>'due_date')::date < CURRENT_DATE THEN
      RAISE EXCEPTION 'An action''s due date can''t be in the past';
    END IF;
    v_base := 'CA-' || to_char(CURRENT_DATE, 'YYYYMM') || '-';
    SELECT COALESCE(MAX(NULLIF(regexp_replace(action_number, '^.*-', ''), '')::int), 0) + 1 INTO v_seq
      FROM public.construction_corrective_actions WHERE action_number LIKE v_base || '%';
    INSERT INTO public.construction_corrective_actions
      (action_number, company_id, project_id, source_type, source_id, action_type, description, assigned_to, due_date, created_by)
    VALUES (v_base || lpad(v_seq::text, 4, '0'), src.company_id, src.project_id, p_source_type, p_source_id,
            COALESCE(NULLIF(a->>'action_type', ''), 'corrective'), btrim(a->>'description'), v_user,
            NULLIF(a->>'due_date', '')::date, auth.uid());
    v_n := v_n + 1;
  END LOOP;
  RETURN v_n;
END;
$$;

CREATE OR REPLACE FUNCTION public.add_corrective_action(
  p_source_type text, p_source_id uuid, p_description text,
  p_action_type text DEFAULT 'corrective', p_assigned_to uuid DEFAULT NULL, p_due_date date DEFAULT NULL)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  src record;
BEGIN
  SELECT * INTO src FROM public.qhse_source(p_source_type, p_source_id);
  IF NOT public.can_record_qhse(src.company_id) THEN
    RAISE EXCEPTION 'Only construction or HSE users of this company can add actions' USING ERRCODE = '42501';
  END IF;
  IF NOT src.open_for_actions THEN
    RAISE EXCEPTION '% isn''t open for actions (start it, or record its result, first)', src.ref;
  END IF;
  PERFORM public.insert_corrective_actions(p_source_type, p_source_id,
    jsonb_build_array(jsonb_build_object('description', p_description, 'action_type', p_action_type,
                                         'assigned_to', p_assigned_to, 'due_date', p_due_date)));
  RETURN (SELECT id FROM public.construction_corrective_actions
           WHERE source_type = p_source_type AND source_id = p_source_id ORDER BY created_at DESC, action_number DESC LIMIT 1);
END;
$$;

-- The owner (or a construction/HSE user) marks it done.
CREATE OR REPLACE FUNCTION public.complete_corrective_action(p_action_id uuid, p_note text)
RETURNS text
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  a public.construction_corrective_actions%ROWTYPE;
BEGIN
  SELECT * INTO a FROM public.construction_corrective_actions WHERE id = p_action_id FOR UPDATE;
  IF NOT FOUND OR NOT public.can_access_company(a.company_id)
     OR NOT (a.assigned_to = auth.uid() OR public.can_record_qhse(a.company_id)) THEN
    RAISE EXCEPTION 'Only the action''s owner or a construction/HSE user can complete it' USING ERRCODE = '42501';
  END IF;
  IF a.status <> 'open' THEN RAISE EXCEPTION 'This action is already %', a.status; END IF;
  IF NULLIF(btrim(COALESCE(p_note, '')), '') IS NULL THEN RAISE EXCEPTION 'Say what was done'; END IF;
  UPDATE public.construction_corrective_actions
     SET status = 'done', completion_note = btrim(p_note), completed_by = auth.uid(), completed_at = now(), updated_at = now()
   WHERE id = p_action_id;
  RETURN 'done';
END;
$$;

CREATE OR REPLACE FUNCTION public.corrective_action_block_reason(p_action_id uuid)
RETURNS text
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  a public.construction_corrective_actions%ROWTYPE;
BEGIN
  SELECT * INTO a FROM public.construction_corrective_actions WHERE id = p_action_id;
  IF NOT FOUND THEN RETURN 'Action not found'; END IF;
  IF a.status <> 'done' THEN RETURN 'This action isn''t waiting for verification'; END IF;
  IF NOT public.can_decide_construction(a.company_id, a.project_id) THEN
    RETURN 'Only the project manager, a construction or HSE manager, or an admin can verify actions';
  END IF;
  IF a.completed_by = auth.uid() THEN RETURN 'You completed this action, so someone else must verify it'; END IF;
  RETURN NULL;
END;
$$;

-- A manager checks the work: verified, or back to open with a note.
CREATE OR REPLACE FUNCTION public.verify_corrective_action(p_action_id uuid, p_accept boolean, p_note text DEFAULT NULL)
RETURNS text
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_reason text;
  v_note text := NULLIF(btrim(COALESCE(p_note, '')), '');
BEGIN
  PERFORM 1 FROM public.construction_corrective_actions WHERE id = p_action_id FOR UPDATE;
  v_reason := public.corrective_action_block_reason(p_action_id);
  IF v_reason IS NOT NULL THEN RAISE EXCEPTION '%', v_reason USING ERRCODE = '42501'; END IF;
  IF NOT p_accept AND v_note IS NULL THEN RAISE EXCEPTION 'Say what still needs doing'; END IF;
  UPDATE public.construction_corrective_actions
     SET status = CASE WHEN p_accept THEN 'verified' ELSE 'open' END,
         verified_by = CASE WHEN p_accept THEN auth.uid() END,
         verified_at = CASE WHEN p_accept THEN now() END,
         verification_note = v_note,
         completed_by = CASE WHEN p_accept THEN completed_by END,
         completed_at = CASE WHEN p_accept THEN completed_at END,
         updated_at = now()
   WHERE id = p_action_id;
  RETURN CASE WHEN p_accept THEN 'verified' ELSE 'open' END;
END;
$$;

CREATE OR REPLACE FUNCTION public.cancel_corrective_action(p_action_id uuid, p_reason text)
RETURNS text
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  a public.construction_corrective_actions%ROWTYPE;
BEGIN
  SELECT * INTO a FROM public.construction_corrective_actions WHERE id = p_action_id FOR UPDATE;
  IF NOT FOUND OR NOT public.can_decide_construction(a.company_id, a.project_id) THEN
    RAISE EXCEPTION 'Only the project manager, a construction or HSE manager, or an admin can cancel actions' USING ERRCODE = '42501';
  END IF;
  IF a.status NOT IN ('open', 'done') THEN RAISE EXCEPTION 'This action is already %', a.status; END IF;
  IF NULLIF(btrim(COALESCE(p_reason, '')), '') IS NULL THEN RAISE EXCEPTION 'Give a reason for cancelling'; END IF;
  UPDATE public.construction_corrective_actions
     SET status = 'cancelled', verification_note = btrim(p_reason), verified_by = auth.uid(), verified_at = now(), updated_at = now()
   WHERE id = p_action_id;
  RETURN 'cancelled';
END;
$$;

-- Keep each record's follow-up fields in step with its open actions.
CREATE OR REPLACE FUNCTION public.refresh_qhse_follow_up()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_open boolean;
  v_due date;
BEGIN
  SELECT bool_or(status IN ('open', 'done')), MIN(due_date) FILTER (WHERE status = 'open')
    INTO v_open, v_due
    FROM public.construction_corrective_actions
   WHERE source_type = NEW.source_type AND source_id = NEW.source_id;
  IF NEW.source_type = 'safety_inspection' THEN
    UPDATE public.safety_inspections
       SET follow_up_required = COALESCE(v_open, false), follow_up_date = v_due, updated_at = now()
     WHERE id = NEW.source_id;
  ELSIF NEW.source_type = 'quality_inspection' THEN
    UPDATE public.quality_inspections SET follow_up_date = v_due, updated_at = now() WHERE id = NEW.source_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_refresh_qhse_follow_up ON public.construction_corrective_actions;
CREATE TRIGGER trg_refresh_qhse_follow_up
  AFTER INSERT OR UPDATE OF status, due_date ON public.construction_corrective_actions
  FOR EACH ROW EXECUTE FUNCTION public.refresh_qhse_follow_up();

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. Quality inspections
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.quality_inspections
  ADD COLUMN IF NOT EXISTS reinspection_of uuid REFERENCES public.quality_inspections(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS started_at timestamptz,
  ADD COLUMN IF NOT EXISTS result_recorded_by uuid,
  ADD COLUMN IF NOT EXISTS result_recorded_at timestamptz;

UPDATE public.quality_inspections SET status = 'scheduled'
 WHERE status IS NULL OR status NOT IN ('scheduled', 'in_progress', 'completed', 'failed');
UPDATE public.quality_inspections SET overall_result = NULL
 WHERE overall_result IS NOT NULL AND overall_result NOT IN ('pass', 'fail', 'conditional_pass');
ALTER TABLE public.quality_inspections ALTER COLUMN status SET DEFAULT 'scheduled';
ALTER TABLE public.quality_inspections ALTER COLUMN status SET NOT NULL;
ALTER TABLE public.quality_inspections DROP CONSTRAINT IF EXISTS quality_inspections_status_check;
ALTER TABLE public.quality_inspections
  ADD CONSTRAINT quality_inspections_status_check CHECK (status IN ('scheduled', 'in_progress', 'completed', 'failed'));
ALTER TABLE public.quality_inspections DROP CONSTRAINT IF EXISTS quality_inspections_result_check;
ALTER TABLE public.quality_inspections
  ADD CONSTRAINT quality_inspections_result_check CHECK (overall_result IS NULL OR overall_result IN ('pass', 'fail', 'conditional_pass'));

DROP POLICY IF EXISTS "Authenticated users can create quality inspections" ON public.quality_inspections;
DROP POLICY IF EXISTS "Users can create quality inspections" ON public.quality_inspections;
CREATE POLICY "Users can create quality inspections" ON public.quality_inspections
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL AND public.can_access_company(company_id));

CREATE OR REPLACE FUNCTION public.start_quality_inspection(p_id uuid)
RETURNS text
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  q public.quality_inspections%ROWTYPE;
BEGIN
  SELECT * INTO q FROM public.quality_inspections WHERE id = p_id FOR UPDATE;
  IF NOT FOUND OR NOT public.can_record_qhse(q.company_id) THEN
    RAISE EXCEPTION 'Only construction users of this company can run inspections' USING ERRCODE = '42501';
  END IF;
  IF q.status <> 'scheduled' THEN RAISE EXCEPTION 'This inspection is already %', replace(q.status, '_', ' '); END IF;
  UPDATE public.quality_inspections
     SET status = 'in_progress', started_at = now(), inspector_id = COALESCE(inspector_id, auth.uid()), updated_at = now()
   WHERE id = p_id;
  RETURN 'in_progress';
END;
$$;

-- pass → completed; conditional pass → completed with actions; fail → failed
-- with findings and actions.
CREATE OR REPLACE FUNCTION public.record_quality_result(p_id uuid, p_result text, p_findings text, p_actions jsonb DEFAULT '[]'::jsonb)
RETURNS text
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  q public.quality_inspections%ROWTYPE;
  v_status text;
  v_actions integer := jsonb_array_length(COALESCE(p_actions, '[]'::jsonb));
BEGIN
  SELECT * INTO q FROM public.quality_inspections WHERE id = p_id FOR UPDATE;
  IF NOT FOUND OR NOT public.can_record_qhse(q.company_id) THEN
    RAISE EXCEPTION 'Only construction users of this company can record results' USING ERRCODE = '42501';
  END IF;
  IF q.status NOT IN ('scheduled', 'in_progress') THEN
    RAISE EXCEPTION 'This inspection is already %', q.status;
  END IF;
  IF p_result NOT IN ('pass', 'fail', 'conditional_pass') THEN RAISE EXCEPTION 'Choose pass, conditional pass or fail'; END IF;
  IF p_result <> 'pass' AND NULLIF(btrim(COALESCE(p_findings, '')), '') IS NULL THEN
    RAISE EXCEPTION 'Record the findings';
  END IF;
  IF p_result <> 'pass' AND v_actions = 0 THEN
    RAISE EXCEPTION 'Add at least one corrective action';
  END IF;
  v_status := CASE WHEN p_result = 'fail' THEN 'failed' ELSE 'completed' END;
  UPDATE public.quality_inspections
     SET status = v_status, overall_result = p_result,
         findings = COALESCE(NULLIF(btrim(COALESCE(p_findings, '')), ''), findings),
         started_at = COALESCE(started_at, now()), inspector_id = COALESCE(inspector_id, auth.uid()),
         result_recorded_by = auth.uid(), result_recorded_at = now(), updated_at = now()
   WHERE id = p_id;
  IF v_actions > 0 THEN
    PERFORM public.insert_corrective_actions('quality_inspection', p_id, p_actions);
  END IF;
  RETURN v_status;
END;
$$;

-- A failed inspection is re-inspected once none of its actions is still open.
CREATE OR REPLACE FUNCTION public.schedule_reinspection(p_id uuid, p_date date)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  q public.quality_inspections%ROWTYPE;
  v_new uuid;
BEGIN
  SELECT * INTO q FROM public.quality_inspections WHERE id = p_id FOR UPDATE;
  IF NOT FOUND OR NOT public.can_record_qhse(q.company_id) THEN
    RAISE EXCEPTION 'Only construction users of this company can schedule inspections' USING ERRCODE = '42501';
  END IF;
  IF q.status <> 'failed' THEN RAISE EXCEPTION 'Only a failed inspection is re-inspected'; END IF;
  IF EXISTS (SELECT 1 FROM public.quality_inspections WHERE reinspection_of = p_id) THEN
    RAISE EXCEPTION 'A re-inspection is already scheduled';
  END IF;
  IF EXISTS (SELECT 1 FROM public.construction_corrective_actions
              WHERE source_type = 'quality_inspection' AND source_id = p_id AND status = 'open') THEN
    RAISE EXCEPTION 'Finish the corrective actions before re-inspecting';
  END IF;
  IF p_date IS NULL OR p_date < CURRENT_DATE THEN RAISE EXCEPTION 'Choose a date from today on'; END IF;
  INSERT INTO public.quality_inspections (project_id, company_id, site_id, work_order_id, inspection_type, title, description,
                                          inspection_date, inspector_id, status, reinspection_of, created_by)
  VALUES (q.project_id, q.company_id, q.site_id, q.work_order_id, q.inspection_type,
          'Re-inspection: ' || COALESCE(q.title, q.inspection_number), q.findings,
          p_date, q.inspector_id, 'scheduled', p_id, auth.uid())
  RETURNING id INTO v_new;
  RETURN v_new;
END;
$$;

CREATE OR REPLACE FUNCTION public.guard_quality_inspection()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF current_user NOT IN ('authenticated', 'anon') THEN
    RETURN COALESCE(NEW, OLD);
  END IF;
  IF TG_OP = 'INSERT' THEN
    IF NEW.status <> 'scheduled' OR NEW.overall_result IS NOT NULL THEN
      RAISE EXCEPTION 'New inspections start as scheduled; record the result from the list';
    END IF;
    NEW.reinspection_of := NULL; NEW.result_recorded_by := NULL; NEW.result_recorded_at := NULL; NEW.started_at := NULL;
    RETURN NEW;
  END IF;
  IF TG_OP = 'DELETE' THEN
    IF OLD.status <> 'scheduled' THEN RAISE EXCEPTION 'Only a scheduled inspection can be deleted'; END IF;
    RETURN OLD;
  END IF;
  IF OLD.status IN ('completed', 'failed') THEN
    RAISE EXCEPTION 'This inspection is %, so it can''t be changed', OLD.status;
  END IF;
  IF NEW.status IS DISTINCT FROM OLD.status OR NEW.overall_result IS DISTINCT FROM OLD.overall_result
     OR NEW.reinspection_of IS DISTINCT FROM OLD.reinspection_of
     OR NEW.result_recorded_by IS DISTINCT FROM OLD.result_recorded_by OR NEW.started_at IS DISTINCT FROM OLD.started_at THEN
    RAISE EXCEPTION 'Use Start and Record result to change an inspection''s status';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_quality_inspection ON public.quality_inspections;
CREATE TRIGGER trg_guard_quality_inspection
  BEFORE INSERT OR UPDATE OR DELETE ON public.quality_inspections
  FOR EACH ROW EXECUTE FUNCTION public.guard_quality_inspection();

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. Safety incidents
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.safety_incidents
  ADD COLUMN IF NOT EXISTS investigation_started_at timestamptz,
  ADD COLUMN IF NOT EXISTS closed_by uuid,
  ADD COLUMN IF NOT EXISTS closed_at timestamptz,
  ADD COLUMN IF NOT EXISTS closure_note text;

UPDATE public.safety_incidents SET status = 'reported'
 WHERE status IS NULL OR status NOT IN ('reported', 'investigating', 'closed');
ALTER TABLE public.safety_incidents ALTER COLUMN status SET DEFAULT 'reported';
ALTER TABLE public.safety_incidents ALTER COLUMN status SET NOT NULL;
ALTER TABLE public.safety_incidents DROP CONSTRAINT IF EXISTS safety_incidents_status_check;
ALTER TABLE public.safety_incidents
  ADD CONSTRAINT safety_incidents_status_check CHECK (status IN ('reported', 'investigating', 'closed'));

CREATE OR REPLACE FUNCTION public.is_serious_incident(p_severity text, p_type text)
RETURNS boolean
LANGUAGE sql IMMUTABLE
AS $$ SELECT COALESCE(p_severity, '') IN ('high', 'critical') OR COALESCE(p_type, '') IN ('lost_time', 'fatality') $$;

CREATE OR REPLACE FUNCTION public.start_incident_investigation(p_id uuid)
RETURNS text
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  s public.safety_incidents%ROWTYPE;
BEGIN
  SELECT * INTO s FROM public.safety_incidents WHERE id = p_id FOR UPDATE;
  IF NOT FOUND OR NOT public.can_record_qhse(s.company_id) THEN
    RAISE EXCEPTION 'Only construction or HSE users of this company can investigate incidents' USING ERRCODE = '42501';
  END IF;
  IF s.status <> 'reported' THEN RAISE EXCEPTION 'This incident is already %', s.status; END IF;
  UPDATE public.safety_incidents
     SET status = 'investigating', investigated_by = auth.uid(), investigation_started_at = now(), updated_at = now()
   WHERE id = p_id;
  RETURN 'investigating';
END;
$$;

CREATE OR REPLACE FUNCTION public.close_safety_incident(p_id uuid, p_root_cause text, p_preventive_actions text DEFAULT NULL, p_note text DEFAULT NULL)
RETURNS text
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  s public.safety_incidents%ROWTYPE;
BEGIN
  SELECT * INTO s FROM public.safety_incidents WHERE id = p_id FOR UPDATE;
  IF NOT FOUND OR NOT public.can_record_qhse(s.company_id) THEN
    RAISE EXCEPTION 'Only construction or HSE users of this company can close incidents' USING ERRCODE = '42501';
  END IF;
  IF s.status <> 'investigating' THEN RAISE EXCEPTION 'Investigate the incident before closing it'; END IF;
  IF public.is_serious_incident(s.severity, s.incident_type) AND NOT public.can_decide_construction(s.company_id, s.project_id) THEN
    RAISE EXCEPTION 'A serious incident is closed by the project manager, a manager or an admin' USING ERRCODE = '42501';
  END IF;
  IF NULLIF(btrim(COALESCE(p_root_cause, '')), '') IS NULL THEN RAISE EXCEPTION 'Record the root cause'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.construction_corrective_actions
                  WHERE source_type = 'safety_incident' AND source_id = p_id AND status <> 'cancelled') THEN
    RAISE EXCEPTION 'Add at least one corrective or preventive action';
  END IF;
  IF EXISTS (SELECT 1 FROM public.construction_corrective_actions
              WHERE source_type = 'safety_incident' AND source_id = p_id AND status = 'open') THEN
    RAISE EXCEPTION 'Some actions are still open';
  END IF;
  UPDATE public.safety_incidents
     SET status = 'closed', root_cause = btrim(p_root_cause),
         preventive_actions = COALESCE(NULLIF(btrim(COALESCE(p_preventive_actions, '')), ''), preventive_actions),
         corrective_actions = COALESCE(
           (SELECT string_agg(action_number || ': ' || description, E'\n' ORDER BY action_number)
              FROM public.construction_corrective_actions
             WHERE source_type = 'safety_incident' AND source_id = p_id AND status <> 'cancelled'), corrective_actions),
         closure_note = NULLIF(btrim(COALESCE(p_note, '')), ''), closed_by = auth.uid(), closed_at = now(), updated_at = now()
   WHERE id = p_id;
  RETURN 'closed';
END;
$$;

CREATE OR REPLACE FUNCTION public.guard_safety_incident()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF current_user NOT IN ('authenticated', 'anon') THEN
    RETURN COALESCE(NEW, OLD);
  END IF;
  IF TG_OP = 'INSERT' THEN
    IF NEW.status <> 'reported' THEN RAISE EXCEPTION 'New incidents start as reported'; END IF;
    NEW.investigated_by := NULL; NEW.closed_by := NULL; NEW.closed_at := NULL; NEW.investigation_started_at := NULL;
    RETURN NEW;
  END IF;
  IF TG_OP = 'DELETE' THEN
    IF OLD.status <> 'reported' THEN RAISE EXCEPTION 'An incident under investigation or closed can''t be deleted'; END IF;
    RETURN OLD;
  END IF;
  IF OLD.status = 'closed' THEN RAISE EXCEPTION 'This incident is closed, so it can''t be changed'; END IF;
  IF NEW.status IS DISTINCT FROM OLD.status OR NEW.investigated_by IS DISTINCT FROM OLD.investigated_by
     OR NEW.closed_by IS DISTINCT FROM OLD.closed_by OR NEW.closed_at IS DISTINCT FROM OLD.closed_at
     OR NEW.investigation_started_at IS DISTINCT FROM OLD.investigation_started_at THEN
    RAISE EXCEPTION 'Use Investigate and Close to change an incident''s status';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_safety_incident ON public.safety_incidents;
CREATE TRIGGER trg_guard_safety_incident
  BEFORE INSERT OR UPDATE OR DELETE ON public.safety_incidents
  FOR EACH ROW EXECUTE FUNCTION public.guard_safety_incident();

-- ─────────────────────────────────────────────────────────────────────────────
-- 5. Safety inspections
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.safety_inspections
  ADD COLUMN IF NOT EXISTS completed_by uuid,
  ADD COLUMN IF NOT EXISTS completed_at timestamptz;

UPDATE public.safety_inspections SET status = 'scheduled'
 WHERE status IS NULL OR status NOT IN ('scheduled', 'completed');
ALTER TABLE public.safety_inspections ALTER COLUMN status SET DEFAULT 'scheduled';
ALTER TABLE public.safety_inspections ALTER COLUMN status SET NOT NULL;
ALTER TABLE public.safety_inspections DROP CONSTRAINT IF EXISTS safety_inspections_status_check;
ALTER TABLE public.safety_inspections
  ADD CONSTRAINT safety_inspections_status_check CHECK (status IN ('scheduled', 'completed'));

CREATE OR REPLACE FUNCTION public.complete_safety_inspection(p_id uuid, p_score numeric, p_findings text,
  p_hazards text DEFAULT NULL, p_actions jsonb DEFAULT '[]'::jsonb)
RETURNS text
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  s public.safety_inspections%ROWTYPE;
  v_hazards text := NULLIF(btrim(COALESCE(p_hazards, '')), '');
  v_actions integer := jsonb_array_length(COALESCE(p_actions, '[]'::jsonb));
BEGIN
  SELECT * INTO s FROM public.safety_inspections WHERE id = p_id FOR UPDATE;
  IF NOT FOUND OR NOT public.can_record_qhse(s.company_id) THEN
    RAISE EXCEPTION 'Only construction or HSE users of this company can complete inspections' USING ERRCODE = '42501';
  END IF;
  IF s.status <> 'scheduled' THEN RAISE EXCEPTION 'This inspection is already completed'; END IF;
  IF p_score IS NULL OR p_score < 0 OR p_score > 100 THEN RAISE EXCEPTION 'Give a score from 0 to 100'; END IF;
  IF v_hazards IS NOT NULL AND v_actions = 0 THEN
    RAISE EXCEPTION 'Hazards were found: add at least one corrective action';
  END IF;
  UPDATE public.safety_inspections
     SET status = 'completed', overall_score = p_score,
         findings = COALESCE(NULLIF(btrim(COALESCE(p_findings, '')), ''), findings),
         hazards_identified = COALESCE(v_hazards, hazards_identified),
         follow_up_required = v_actions > 0,
         completed_by = auth.uid(), completed_at = now(), updated_at = now()
   WHERE id = p_id;
  IF v_actions > 0 THEN
    PERFORM public.insert_corrective_actions('safety_inspection', p_id, p_actions);
  END IF;
  RETURN 'completed';
END;
$$;

CREATE OR REPLACE FUNCTION public.guard_safety_inspection()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF current_user NOT IN ('authenticated', 'anon') THEN
    RETURN COALESCE(NEW, OLD);
  END IF;
  IF TG_OP = 'INSERT' THEN
    IF NEW.status <> 'scheduled' THEN RAISE EXCEPTION 'New inspections start as scheduled; complete them from the list'; END IF;
    NEW.completed_by := NULL; NEW.completed_at := NULL;
    RETURN NEW;
  END IF;
  IF TG_OP = 'DELETE' THEN
    IF OLD.status <> 'scheduled' THEN RAISE EXCEPTION 'A completed inspection can''t be deleted'; END IF;
    RETURN OLD;
  END IF;
  IF OLD.status = 'completed' THEN RAISE EXCEPTION 'This inspection is completed, so it can''t be changed'; END IF;
  IF NEW.status IS DISTINCT FROM OLD.status OR NEW.completed_by IS DISTINCT FROM OLD.completed_by
     OR NEW.completed_at IS DISTINCT FROM OLD.completed_at THEN
    RAISE EXCEPTION 'Use Complete to finish an inspection';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_safety_inspection ON public.safety_inspections;
CREATE TRIGGER trg_guard_safety_inspection
  BEFORE INSERT OR UPDATE OR DELETE ON public.safety_inspections
  FOR EACH ROW EXECUTE FUNCTION public.guard_safety_inspection();

-- ─────────────────────────────────────────────────────────────────────────────
-- 6. Grants
-- ─────────────────────────────────────────────────────────────────────────────
DO $$
DECLARE f text;
BEGIN
  FOREACH f IN ARRAY ARRAY[
    'public.company_user_directory(uuid)', 'public.project_location_ids(uuid)',
    'public.site_report_block_reason(uuid)', 'public.submit_site_report(uuid)', 'public.decide_site_report(uuid, boolean, text)',
    'public.add_corrective_action(text, uuid, text, text, uuid, date)', 'public.complete_corrective_action(uuid, text)',
    'public.corrective_action_block_reason(uuid)', 'public.verify_corrective_action(uuid, boolean, text)',
    'public.cancel_corrective_action(uuid, text)',
    'public.start_quality_inspection(uuid)', 'public.record_quality_result(uuid, text, text, jsonb)',
    'public.schedule_reinspection(uuid, date)',
    'public.start_incident_investigation(uuid)', 'public.close_safety_incident(uuid, text, text, text)',
    'public.complete_safety_inspection(uuid, numeric, text, text, jsonb)'
  ] LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon', f);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated', f);
  END LOOP;
  FOREACH f IN ARRAY ARRAY['public.insert_corrective_actions(text, uuid, jsonb)', 'public.qhse_source(text, uuid)'] LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon, authenticated', f);
  END LOOP;
END $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 7. Approval Console: site reports and corrective actions to verify
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.approval_queue(p_scope text DEFAULT 'to_decide')
RETURNS TABLE (
  item_type text,
  item_id uuid,
  reference text,
  title text,
  amount numeric,
  currency text,
  company_id uuid,
  submitted_at timestamptz,
  submitted_by uuid,
  stage text,
  view_url text
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_decide boolean := COALESCE(p_scope, 'to_decide') <> 'submitted';
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Sign in first' USING ERRCODE = '42501'; END IF;

  RETURN QUERY
  WITH items AS (
    -- Purchase orders
    SELECT 'po'::text AS t, po.id, po.po_number AS ref, COALESCE(s.name, 'Purchase order') AS ttl,
           COALESCE(po.final_amount, po.total_amount) AS amt, po.currency AS cur, po.company_id AS co,
           po.updated_at AS at, po.created_by AS who,
           CASE po.status::text WHEN 'pending_approval' THEN 'Merchandiser approval' ELSE 'Department head approval' END AS stg,
           '/procurement/purchase-order' AS url,
           (public.po_approval_block_reason_for(v_uid, po.id, NULL) IS NULL) AS can_decide
      FROM public.purchase_orders po
      LEFT JOIN public.suppliers s ON s.id = po.supplier_id
     WHERE po.status::text IN ('pending_approval', 'pending_dept_head_approval')
    UNION ALL
    -- Purchase requisitions
    SELECT 'pr', pr.id, pr.pr_number, pr.title, public.pr_amount(pr.id), 'LKR', pr.company_id,
           pr.updated_at, pr.requested_by,
           CASE pr.status::text WHEN 'submitted' THEN 'Department head approval' ELSE 'Final approval' END,
           '/procurement/purchase-requisition',
           (public.pr_approval_block_reason_for(v_uid, pr.id) IS NULL)
      FROM public.purchase_requisitions pr
     WHERE pr.status::text IN ('submitted', 'pending_approval')
    UNION ALL
    -- Blanket PO releases
    SELECT 'bpo_release', r.id, r.release_number, 'Release against ' || b.bpo_number, r.total_amount, b.currency, b.company_id,
           r.created_at, r.requested_by, 'Release approval', '/procurement/blanket-po',
           (public.bpo_release_block_reason(r.id) IS NULL)
      FROM public.blanket_po_releases r
      JOIN public.blanket_purchase_orders b ON b.id = r.bpo_id
     WHERE r.release_status::text = 'submitted'
    UNION ALL
    -- PO amendments
    SELECT 'po_amendment', a.id, a.amendment_number, replace(a.amendment_type, '_', ' ') || ' on ' || po.po_number, NULL::numeric,
           po.currency, po.company_id, a.created_at, a.created_by, 'Amendment approval', '/procurement/po-amendment',
           (public.po_amendment_block_reason(a.id) IS NULL)
      FROM public.po_amendments a
      JOIN public.purchase_orders po ON po.id = a.po_id
     WHERE a.status = 'pending'
    UNION ALL
    -- Supplier registrations
    SELECT 'supplier_registration', sr.id, COALESCE(sr.supplier_data->>'supplier_name', 'Registration'),
           CASE WHEN sr.request_type = 'self_service' THEN 'Public supplier application' ELSE 'Supplier registration' END,
           NULL, NULL, sr.company_id, COALESCE(sr.submitted_at, sr.created_at), sr.created_by,
           'Registration approval', '/sourcing/supplier-registration',
           (public.is_admin(v_uid) AND (sr.company_id IS NULL OR public.can_access_company(sr.company_id)))
      FROM public.supplier_registration_requests sr
     WHERE sr.status = 'pending_approval'
    UNION ALL
    -- Material issue notes
    SELECT 'min', n.id, n.min_number, 'Issue to ' || n.issued_to, n.total_value, 'LKR', n.company_id,
           COALESCE(n.submitted_at, n.created_at), COALESCE(n.submitted_by, n.created_by), 'Issue approval',
           '/warehouse/material-issue',
           (public.is_min_approver(v_uid) AND public.can_access_company(n.company_id))
      FROM public.material_issue_notes n
     WHERE n.status = 'pending_approval'
    UNION ALL
    -- Stock transfers
    SELECT 'stock_transfer', t.id, t.transfer_number, 'Stock transfer (' || t.transfer_type || ')', NULL, NULL, t.company_id,
           t.updated_at, COALESCE(t.requested_by, t.created_by), 'Transfer approval', '/warehouse/stock-transfer',
           (public.stock_transfer_block_reason(t.id) IS NULL)
      FROM public.stock_transfer_requests t
     WHERE t.status = 'pending_approval'
    UNION ALL
    -- Customer POs
    SELECT 'customer_po', c.id, c.cpo_number, COALESCE(cu.customer_name, 'Customer PO'), c.total_amount, 'LKR', c.company_id,
           c.updated_at, c.created_by, 'Customer PO approval', '/tuh-modules/customer-po/' || c.id,
           (public.is_admin(v_uid) AND public.can_access_company(c.company_id))
      FROM public.customer_purchase_orders c
      LEFT JOIN public.customers cu ON cu.id = c.customer_id
     WHERE c.status = 'pending_approval'
    UNION ALL
    -- Social-media access
    SELECT 'social_media_access', sa.id, acc.account_name, 'Access (' || sa.access_level || ') for '
             || COALESCE((SELECT COALESCE(p.full_name, p.email) FROM public.profiles p WHERE p.user_id = sa.user_id), 'a user'),
           NULL, NULL, sa.company_id, COALESCE(sa.requested_at, sa.created_at), sa.requested_by, 'Access approval',
           '/social-media/access',
           (public.social_media_access_block_reason(sa.id) IS NULL)
      FROM public.social_media_access sa
      JOIN public.social_media_accounts acc ON acc.id = sa.account_id
     WHERE sa.status = 'pending'
    UNION ALL
    -- Production receipts
    SELECT 'production_receipt', b.id, b.batch_number, COALESCE(fg.product_name, 'Production receipt') || ' × ' || b.quantity,
           b.production_cost, 'LKR', b.company_id, b.created_at, b.created_by, 'Receipt approval', '/tuh-modules/finished-goods',
           (public.is_admin(v_uid) AND public.can_access_company(b.company_id))
      FROM public.finished_goods_batches b
      LEFT JOIN public.finished_goods fg ON fg.id = b.finished_good_id
     WHERE b.approval_status = 'pending'
    UNION ALL
    -- Daily site reports
    SELECT 'site_report', d.id, d.report_number, COALESCE(cp.project_name, 'Site report') || ' · ' || to_char(d.report_date, 'DD Mon YYYY'),
           NULL, NULL, d.company_id, COALESCE(d.submitted_at, d.updated_at), d.submitted_by, 'Site report approval',
           '/construction/daily-reports',
           (public.site_report_block_reason(d.id) IS NULL)
      FROM public.daily_site_reports d
      LEFT JOIN public.construction_projects cp ON cp.id = d.project_id
     WHERE d.status = 'submitted'
    UNION ALL
    -- Corrective actions done, waiting for verification
    SELECT 'corrective_action', ca.id, ca.action_number, ca.description, NULL, NULL, ca.company_id,
           ca.completed_at, ca.completed_by, 'Verify corrective action',
           CASE WHEN ca.source_type = 'quality_inspection' THEN '/construction/quality-control' ELSE '/construction/safety-management' END,
           (public.corrective_action_block_reason(ca.id) IS NULL)
      FROM public.construction_corrective_actions ca
     WHERE ca.status = 'done'
  )
  SELECT i.t, i.id, i.ref, i.ttl, i.amt, i.cur, i.co, i.at, i.who, i.stg, i.url
    FROM items i
   WHERE (v_decide AND i.can_decide)
      OR (NOT v_decide AND i.who = v_uid AND (i.co IS NULL OR public.can_access_company(i.co)))
   ORDER BY i.at DESC NULLS LAST
   LIMIT 300;
END;
$$;

CREATE OR REPLACE FUNCTION public.decide_approval_item(p_type text, p_id uuid, p_approve boolean, p_comments text DEFAULT NULL)
RETURNS text
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_comments text := NULLIF(btrim(COALESCE(p_comments, '')), '');
  v_reason text;
  v_sr public.supplier_registration_requests%ROWTYPE;
  v_b public.finished_goods_batches%ROWTYPE;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Sign in first' USING ERRCODE = '42501'; END IF;
  IF NOT p_approve AND v_comments IS NULL THEN RAISE EXCEPTION 'Give a reason for rejecting'; END IF;

  CASE p_type
    WHEN 'po' THEN
      PERFORM public.decide_po_approval(p_id, p_approve, v_comments);
    WHEN 'pr' THEN
      RETURN public.decide_purchase_requisition(p_id, p_approve, v_comments);
    WHEN 'bpo_release' THEN
      PERFORM public.decide_bpo_release(p_id, p_approve, v_comments);
    WHEN 'po_amendment' THEN
      PERFORM public.decide_po_amendment(p_id, p_approve, v_comments);
    WHEN 'social_media_access' THEN
      RETURN public.decide_social_media_access(p_id, p_approve, v_comments);
    WHEN 'customer_po' THEN
      RETURN public.decide_customer_po(p_id, p_approve, v_comments);
    WHEN 'site_report' THEN
      RETURN public.decide_site_report(p_id, p_approve, v_comments);
    WHEN 'corrective_action' THEN
      RETURN public.verify_corrective_action(p_id, p_approve, v_comments);
    WHEN 'min' THEN
      IF p_approve THEN PERFORM public.approve_material_issue(p_id);
      ELSE PERFORM public.reject_material_issue(p_id, v_comments);
      END IF;
    WHEN 'supplier_registration' THEN
      IF p_approve THEN
        -- Registrations that match an existing supplier are decided on their own screen (link or reason).
        PERFORM public.approve_supplier_registration(p_id, v_comments, NULL, NULL);
      ELSE
        SELECT * INTO v_sr FROM public.supplier_registration_requests WHERE id = p_id FOR UPDATE;
        IF NOT FOUND OR NOT public.is_admin(v_uid) THEN
          RAISE EXCEPTION 'Only an administrator can reject supplier registrations' USING ERRCODE = '42501';
        END IF;
        IF v_sr.status <> 'pending_approval' THEN RAISE EXCEPTION 'This registration isn''t waiting for approval'; END IF;
        UPDATE public.supplier_registration_requests
           SET status = 'rejected', reviewed_by = v_uid, reviewed_at = now(), rejection_reason = v_comments
         WHERE id = p_id;
        INSERT INTO public.supplier_approval_workflow (registration_request_id, stage, status, completed_by, completed_at, notes)
        VALUES (p_id, 'rejected', 'completed', v_uid, now(), v_comments);
      END IF;
    WHEN 'stock_transfer' THEN
      -- Statements here run as the function owner, so the transfer's own
      -- trigger checks are repeated explicitly.
      IF p_approve THEN
        v_reason := public.stock_transfer_block_reason(p_id);
        IF v_reason IS NOT NULL THEN RAISE EXCEPTION '%', v_reason USING ERRCODE = '42501'; END IF;
        UPDATE public.stock_transfer_requests
           SET status = 'approved', approved_by = v_uid, approved_date = now(), updated_at = now()
         WHERE id = p_id AND status = 'pending_approval';
      ELSE
        IF NOT public.can_approve_stock_moves(v_uid)
           OR NOT public.can_access_company((SELECT company_id FROM public.stock_transfer_requests WHERE id = p_id)) THEN
          RAISE EXCEPTION 'Only a warehouse manager or admin can reject transfers' USING ERRCODE = '42501';
        END IF;
        PERFORM public.release_stock_transfer(p_id);
        UPDATE public.stock_transfer_requests
           SET status = 'cancelled', notes = concat_ws(E'\n', NULLIF(notes, ''), 'Rejected: ' || v_comments), updated_at = now()
         WHERE id = p_id AND status = 'pending_approval';
      END IF;
      IF NOT FOUND THEN RAISE EXCEPTION 'This transfer isn''t waiting for approval'; END IF;
    WHEN 'production_receipt' THEN
      SELECT * INTO v_b FROM public.finished_goods_batches WHERE id = p_id FOR UPDATE;
      IF NOT FOUND OR NOT public.is_admin(v_uid) OR NOT public.can_access_company(v_b.company_id) THEN
        RAISE EXCEPTION 'Only an admin of this company can approve production receipts' USING ERRCODE = '42501';
      END IF;
      IF v_b.approval_status <> 'pending' THEN RAISE EXCEPTION 'This receipt isn''t waiting for approval'; END IF;
      UPDATE public.finished_goods_batches
         SET approval_status = CASE WHEN p_approve THEN 'approved' ELSE 'rejected' END,
             approved_by = v_uid, approved_date = now(),
             approval_comments = CASE WHEN p_approve THEN v_comments END,
             rejection_reason = CASE WHEN p_approve THEN NULL ELSE v_comments END,
             updated_at = now()
       WHERE id = p_id;
      INSERT INTO public.finished_goods_batch_approvals (batch_id, approver_id, action, comments)
      VALUES (p_id, v_uid, CASE WHEN p_approve THEN 'approved' ELSE 'rejected' END, v_comments);
    ELSE
      RAISE EXCEPTION 'Unknown approval type %', p_type;
  END CASE;
  RETURN CASE WHEN p_approve THEN 'approved' ELSE 'rejected' END;
END;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- Read-only check after applying:
--   SELECT
--     (SELECT count(*) FROM pg_proc WHERE proname IN ('submit_site_report', 'decide_site_report', 'record_quality_result',
--        'close_safety_incident', 'complete_safety_inspection', 'verify_corrective_action')) AS qhse_fns,  -- 6
--     (SELECT count(*) FROM pg_trigger WHERE tgname IN ('trg_guard_site_report', 'trg_guard_quality_inspection',
--        'trg_guard_safety_incident', 'trg_guard_safety_inspection', 'trg_refresh_qhse_follow_up')) AS qhse_triggers;  -- 5
-- ─────────────────────────────────────────────────────────────────────────────
