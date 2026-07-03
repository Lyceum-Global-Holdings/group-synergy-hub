-- Tool Management modernization — Phase B: calibration (ISO/IEC 17025, ISO 9001 §7.1.5).
-- Per-unit calibration records + a record RPC that updates the unit's next-due date and
-- status (fail → quarantined to in_calibration), plus due/history report RPCs.

CREATE TABLE IF NOT EXISTS public.tool_calibrations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  unit_id uuid NOT NULL REFERENCES public.tool_units(id) ON DELETE CASCADE,
  calibration_date date NOT NULL DEFAULT CURRENT_DATE,
  performed_by text,
  provider text,
  result text NOT NULL DEFAULT 'pass' CHECK (result IN ('pass','fail','adjusted','limited')),
  certificate_number text,
  certificate_url text,
  interval_months integer,
  next_due_date date,
  cost numeric(15,2),
  notes text,
  company_id uuid REFERENCES public.companies(id),
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_tool_calibrations_unit ON public.tool_calibrations (unit_id, calibration_date DESC);
CREATE INDEX IF NOT EXISTS idx_tool_calibrations_company ON public.tool_calibrations (company_id);

DROP TRIGGER IF EXISTS trg_tool_calibrations_updated_at ON public.tool_calibrations;
CREATE TRIGGER trg_tool_calibrations_updated_at
  BEFORE UPDATE ON public.tool_calibrations
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.tool_calibrations ENABLE ROW LEVEL SECURITY;
DO $$
DECLARE t text := 'tool_calibrations';
BEGIN
  EXECUTE format('DROP POLICY IF EXISTS %I_select ON public.%I', t, t);
  EXECUTE format('DROP POLICY IF EXISTS %I_insert ON public.%I', t, t);
  EXECUTE format('DROP POLICY IF EXISTS %I_update ON public.%I', t, t);
  EXECUTE format('DROP POLICY IF EXISTS %I_delete ON public.%I', t, t);
  EXECUTE format($p$CREATE POLICY %I_select ON public.%I FOR SELECT TO authenticated USING (public.can_access_company(company_id))$p$, t, t);
  EXECUTE format($p$CREATE POLICY %I_insert ON public.%I FOR INSERT TO authenticated WITH CHECK (public.can_access_company(company_id))$p$, t, t);
  EXECUTE format($p$CREATE POLICY %I_update ON public.%I FOR UPDATE TO authenticated USING (public.can_access_company(company_id)) WITH CHECK (public.can_access_company(company_id))$p$, t, t);
  EXECUTE format($p$CREATE POLICY %I_delete ON public.%I FOR DELETE TO authenticated USING (public.is_admin(auth.uid()))$p$, t, t);
END$$;

-- Record a calibration → writes the record, updates the unit next-due + status, logs an event.
CREATE OR REPLACE FUNCTION public.record_tool_calibration(
  p_unit_id uuid,
  p_calibration_date date DEFAULT CURRENT_DATE,
  p_result text DEFAULT 'pass',
  p_performed_by text DEFAULT NULL,
  p_provider text DEFAULT NULL,
  p_certificate_number text DEFAULT NULL,
  p_certificate_url text DEFAULT NULL,
  p_interval_months integer DEFAULT NULL,
  p_cost numeric DEFAULT NULL,
  p_next_due_date date DEFAULT NULL,
  p_notes text DEFAULT NULL
)
RETURNS public.tool_calibrations
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_uid      uuid := auth.uid();
  v_company  uuid;
  v_tool     uuid;
  v_interval integer;
  v_next     date;
  v_rec      public.tool_calibrations;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Authentication required'; END IF;
  SELECT company_id, tool_id INTO v_company, v_tool FROM public.tool_units WHERE id = p_unit_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Tool unit % not found', p_unit_id; END IF;

  -- Interval: explicit → provided → tool-type policy.
  v_interval := COALESCE(p_interval_months,
                         (SELECT calibration_interval_months FROM public.warehouse_tools WHERE id = v_tool));
  v_next := COALESCE(p_next_due_date,
                     CASE WHEN v_interval IS NOT NULL THEN (p_calibration_date + (v_interval || ' months')::interval)::date END);

  INSERT INTO public.tool_calibrations(
    unit_id, calibration_date, performed_by, provider, result, certificate_number,
    certificate_url, interval_months, next_due_date, cost, notes, company_id, created_by)
  VALUES (p_unit_id, p_calibration_date, p_performed_by, p_provider, p_result, p_certificate_number,
          p_certificate_url, v_interval, v_next, p_cost, p_notes, v_company, v_uid)
  RETURNING * INTO v_rec;

  -- Update the unit: next-due + status (fail quarantines; pass releases from calibration).
  UPDATE public.tool_units
     SET next_calibration_due = v_next,
         status = CASE
                    WHEN p_result = 'fail' THEN 'in_calibration'
                    WHEN status = 'in_calibration' THEN 'in_service'
                    ELSE status
                  END,
         updated_at = now()
   WHERE id = p_unit_id;

  INSERT INTO public.tool_unit_events(unit_id, event_type, to_value, reference, notes, created_by, company_id)
  VALUES (p_unit_id, 'calibration', p_result, p_certificate_number,
          COALESCE(p_notes, 'Calibration recorded') || CASE WHEN v_next IS NOT NULL THEN ' (next due ' || v_next || ')' ELSE '' END,
          v_uid, v_company);

  RETURN v_rec;
END;
$$;
GRANT EXECUTE ON FUNCTION public.record_tool_calibration(uuid, date, text, text, text, text, text, integer, numeric, date, text) TO authenticated;

-- Report: calibration due / overdue (serialized units of calibration-tracked tools).
CREATE OR REPLACE FUNCTION public.report_tool_calibration_due(
  p_company_id uuid,
  p_date_from date DEFAULT NULL,
  p_date_to date DEFAULT NULL,
  p_status text DEFAULT NULL
)
RETURNS TABLE (
  tool_code text, tool_name text, unit_code text, serial_number text,
  location_name text, unit_status text, last_calibration_date date,
  next_due_date date, days_to_due integer, due_state text
)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public
AS $$
  SELECT t.tool_code, t.name, u.unit_code, u.serial_number,
         wl.name,
         u.status,
         (SELECT MAX(c.calibration_date) FROM tool_calibrations c WHERE c.unit_id = u.id),
         u.next_calibration_due,
         (u.next_calibration_due - CURRENT_DATE)::int,
         CASE WHEN u.next_calibration_due IS NULL THEN 'unscheduled'
              WHEN u.next_calibration_due < CURRENT_DATE THEN 'overdue'
              WHEN u.next_calibration_due <= CURRENT_DATE + 30 THEN 'due_soon'
              ELSE 'ok' END
  FROM tool_units u
  JOIN warehouse_tools t ON t.id = u.tool_id
  LEFT JOIN warehouse_locations wl ON wl.id = u.location_id
  WHERE u.company_id = p_company_id
    AND u.status NOT IN ('retired','lost')
    AND (t.calibration_required OR u.next_calibration_due IS NOT NULL)
    AND (p_date_from IS NULL OR u.next_calibration_due >= p_date_from)
    AND (p_date_to IS NULL OR u.next_calibration_due <= p_date_to)
    AND (
      p_status IS NULL OR p_status = 'all'
      OR (p_status = 'overdue'  AND u.next_calibration_due < CURRENT_DATE)
      OR (p_status = 'due_soon' AND u.next_calibration_due >= CURRENT_DATE AND u.next_calibration_due <= CURRENT_DATE + 30)
      OR (p_status = 'unscheduled' AND u.next_calibration_due IS NULL)
    )
  ORDER BY u.next_calibration_due NULLS LAST, t.tool_code
  LIMIT 50000;
$$;
GRANT EXECUTE ON FUNCTION public.report_tool_calibration_due(uuid, date, date, text) TO authenticated;

-- Report: calibration history.
CREATE OR REPLACE FUNCTION public.report_tool_calibration_history(
  p_company_id uuid,
  p_date_from date DEFAULT NULL,
  p_date_to date DEFAULT NULL,
  p_result text DEFAULT NULL
)
RETURNS TABLE (
  calibration_date date, tool_code text, tool_name text, unit_code text,
  result text, provider text, performed_by text, certificate_number text,
  next_due_date date, cost numeric
)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public
AS $$
  SELECT c.calibration_date, t.tool_code, t.name, u.unit_code,
         c.result, c.provider, c.performed_by, c.certificate_number,
         c.next_due_date, c.cost
  FROM tool_calibrations c
  JOIN tool_units u ON u.id = c.unit_id
  JOIN warehouse_tools t ON t.id = u.tool_id
  WHERE c.company_id = p_company_id
    AND (p_date_from IS NULL OR c.calibration_date >= p_date_from)
    AND (p_date_to IS NULL OR c.calibration_date <= p_date_to)
    AND (p_result IS NULL OR p_result = 'all' OR c.result = p_result)
  ORDER BY c.calibration_date DESC, t.tool_code
  LIMIT 50000;
$$;
GRANT EXECUTE ON FUNCTION public.report_tool_calibration_history(uuid, date, date, text) TO authenticated;
