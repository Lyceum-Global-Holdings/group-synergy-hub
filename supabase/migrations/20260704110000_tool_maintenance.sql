-- Tool Management modernization — Phase C: maintenance / service (ISO 55000).
-- Per-unit service records + a record RPC that updates the unit's next-due date and
-- in-service / in-repair status, plus due/history report RPCs.

CREATE TABLE IF NOT EXISTS public.tool_maintenance (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  unit_id uuid NOT NULL REFERENCES public.tool_units(id) ON DELETE CASCADE,
  maintenance_type text NOT NULL DEFAULT 'preventive'
    CHECK (maintenance_type IN ('preventive','repair','inspection','overhaul')),
  maintenance_date date NOT NULL DEFAULT CURRENT_DATE,
  performed_by text,
  provider text,
  cost numeric(15,2),
  description text,
  out_of_service boolean NOT NULL DEFAULT false,
  interval_months integer,
  next_due_date date,
  company_id uuid REFERENCES public.companies(id),
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_tool_maintenance_unit ON public.tool_maintenance (unit_id, maintenance_date DESC);
CREATE INDEX IF NOT EXISTS idx_tool_maintenance_company ON public.tool_maintenance (company_id);

DROP TRIGGER IF EXISTS trg_tool_maintenance_updated_at ON public.tool_maintenance;
CREATE TRIGGER trg_tool_maintenance_updated_at
  BEFORE UPDATE ON public.tool_maintenance
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.tool_maintenance ENABLE ROW LEVEL SECURITY;
DO $$
DECLARE t text := 'tool_maintenance';
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

-- Record maintenance → record + unit next-due + status + timeline event.
CREATE OR REPLACE FUNCTION public.record_tool_maintenance(
  p_unit_id uuid,
  p_maintenance_type text DEFAULT 'preventive',
  p_maintenance_date date DEFAULT CURRENT_DATE,
  p_performed_by text DEFAULT NULL,
  p_provider text DEFAULT NULL,
  p_cost numeric DEFAULT NULL,
  p_description text DEFAULT NULL,
  p_out_of_service boolean DEFAULT false,
  p_interval_months integer DEFAULT NULL,
  p_next_due_date date DEFAULT NULL
)
RETURNS public.tool_maintenance
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
  v_rec      public.tool_maintenance;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Authentication required'; END IF;
  SELECT company_id, tool_id INTO v_company, v_tool FROM public.tool_units WHERE id = p_unit_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Tool unit % not found', p_unit_id; END IF;

  v_interval := COALESCE(p_interval_months,
                         (SELECT maintenance_interval_months FROM public.warehouse_tools WHERE id = v_tool));
  v_next := COALESCE(p_next_due_date,
                     CASE WHEN v_interval IS NOT NULL THEN (p_maintenance_date + (v_interval || ' months')::interval)::date END);

  INSERT INTO public.tool_maintenance(
    unit_id, maintenance_type, maintenance_date, performed_by, provider, cost,
    description, out_of_service, interval_months, next_due_date, company_id, created_by)
  VALUES (p_unit_id, p_maintenance_type, p_maintenance_date, p_performed_by, p_provider, p_cost,
          p_description, p_out_of_service, v_interval, v_next, v_company, v_uid)
  RETURNING * INTO v_rec;

  UPDATE public.tool_units
     SET next_maintenance_due = v_next,
         status = CASE
                    WHEN p_out_of_service THEN 'in_repair'
                    WHEN status = 'in_repair' THEN 'in_service'
                    ELSE status
                  END,
         updated_at = now()
   WHERE id = p_unit_id;

  INSERT INTO public.tool_unit_events(unit_id, event_type, to_value, notes, created_by, company_id)
  VALUES (p_unit_id, 'maintenance', p_maintenance_type,
          COALESCE(p_description, 'Maintenance recorded')
            || CASE WHEN p_out_of_service THEN ' (out of service)' ELSE '' END
            || CASE WHEN v_next IS NOT NULL THEN ' (next due ' || v_next || ')' ELSE '' END,
          v_uid, v_company);

  RETURN v_rec;
END;
$$;
GRANT EXECUTE ON FUNCTION public.record_tool_maintenance(uuid, text, date, text, text, numeric, text, boolean, integer, date) TO authenticated;

-- Report: maintenance due / overdue.
CREATE OR REPLACE FUNCTION public.report_tool_maintenance_due(
  p_company_id uuid,
  p_date_from date DEFAULT NULL,
  p_date_to date DEFAULT NULL,
  p_status text DEFAULT NULL
)
RETURNS TABLE (
  tool_code text, tool_name text, unit_code text, serial_number text,
  location_name text, unit_status text, last_service_date date,
  next_due_date date, days_to_due integer, due_state text
)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public
AS $$
  SELECT t.tool_code, t.name, u.unit_code, u.serial_number, wl.name, u.status,
         (SELECT MAX(m.maintenance_date) FROM tool_maintenance m WHERE m.unit_id = u.id),
         u.next_maintenance_due,
         (u.next_maintenance_due - CURRENT_DATE)::int,
         CASE WHEN u.next_maintenance_due IS NULL THEN 'unscheduled'
              WHEN u.next_maintenance_due < CURRENT_DATE THEN 'overdue'
              WHEN u.next_maintenance_due <= CURRENT_DATE + 30 THEN 'due_soon'
              ELSE 'ok' END
  FROM tool_units u
  JOIN warehouse_tools t ON t.id = u.tool_id
  LEFT JOIN warehouse_locations wl ON wl.id = u.location_id
  WHERE u.company_id = p_company_id
    AND u.status NOT IN ('retired','lost')
    AND (t.maintenance_interval_months IS NOT NULL OR u.next_maintenance_due IS NOT NULL OR u.status = 'in_repair')
    AND (p_date_from IS NULL OR u.next_maintenance_due >= p_date_from)
    AND (p_date_to IS NULL OR u.next_maintenance_due <= p_date_to)
    AND (
      p_status IS NULL OR p_status = 'all'
      OR (p_status = 'overdue'  AND u.next_maintenance_due < CURRENT_DATE)
      OR (p_status = 'due_soon' AND u.next_maintenance_due >= CURRENT_DATE AND u.next_maintenance_due <= CURRENT_DATE + 30)
      OR (p_status = 'in_repair' AND u.status = 'in_repair')
      OR (p_status = 'unscheduled' AND u.next_maintenance_due IS NULL)
    )
  ORDER BY u.next_maintenance_due NULLS LAST, t.tool_code
  LIMIT 50000;
$$;
GRANT EXECUTE ON FUNCTION public.report_tool_maintenance_due(uuid, date, date, text) TO authenticated;

-- Report: maintenance / service history.
CREATE OR REPLACE FUNCTION public.report_tool_maintenance_history(
  p_company_id uuid,
  p_date_from date DEFAULT NULL,
  p_date_to date DEFAULT NULL,
  p_type text DEFAULT NULL
)
RETURNS TABLE (
  maintenance_date date, tool_code text, tool_name text, unit_code text,
  maintenance_type text, provider text, performed_by text, description text,
  next_due_date date, cost numeric
)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public
AS $$
  SELECT m.maintenance_date, t.tool_code, t.name, u.unit_code,
         m.maintenance_type, m.provider, m.performed_by, m.description,
         m.next_due_date, m.cost
  FROM tool_maintenance m
  JOIN tool_units u ON u.id = m.unit_id
  JOIN warehouse_tools t ON t.id = u.tool_id
  WHERE m.company_id = p_company_id
    AND (p_date_from IS NULL OR m.maintenance_date >= p_date_from)
    AND (p_date_to IS NULL OR m.maintenance_date <= p_date_to)
    AND (p_type IS NULL OR p_type = 'all' OR m.maintenance_type = p_type)
  ORDER BY m.maintenance_date DESC, t.tool_code
  LIMIT 50000;
$$;
GRANT EXECUTE ON FUNCTION public.report_tool_maintenance_history(uuid, date, date, text) TO authenticated;
