-- Tool Management modernization — Phase D: assignment, alerts (due summary),
-- cost report, and the fixed-asset (depreciation) link.

-- 1. Assignment: link a tool issue to a job / project (the person is already
--    captured by issued_to_name).
ALTER TABLE public.tool_issues
  ADD COLUMN IF NOT EXISTS job_reference text;

-- 2. Depreciation link: warehouse_tools.fixed_asset_id -> asset_master (added as
--    a plain uuid in Phase A; wire the FK now, guarded).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'warehouse_tools_fixed_asset_id_fkey'
  ) THEN
    ALTER TABLE public.warehouse_tools
      ADD CONSTRAINT warehouse_tools_fixed_asset_id_fkey
      FOREIGN KEY (fixed_asset_id) REFERENCES public.asset_master(id);
  END IF;
END$$;

-- 3. Combined "due & overdue" summary for the in-app alerts tab.
CREATE OR REPLACE FUNCTION public.get_tool_due_summary(p_company_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE v jsonb;
BEGIN
  SELECT jsonb_build_object(
    'calibration', (
      SELECT jsonb_build_object(
        'count', COUNT(*),
        'items', COALESCE(jsonb_agg(jsonb_build_object(
          'tool_name', tool_name, 'unit_code', unit_code,
          'next_due_date', next_due_date, 'days_to_due', days_to_due, 'due_state', due_state
        ) ORDER BY next_due_date) FILTER (WHERE rn <= 25), '[]'::jsonb))
      FROM (
        SELECT *, row_number() OVER (ORDER BY next_due_date) rn
        FROM report_tool_calibration_due(p_company_id, NULL, NULL, NULL)
        WHERE due_state IN ('overdue','due_soon')
      ) q
    ),
    'maintenance', (
      SELECT jsonb_build_object(
        'count', COUNT(*),
        'items', COALESCE(jsonb_agg(jsonb_build_object(
          'tool_name', tool_name, 'unit_code', unit_code,
          'next_due_date', next_due_date, 'days_to_due', days_to_due, 'due_state', due_state
        ) ORDER BY next_due_date) FILTER (WHERE rn <= 25), '[]'::jsonb))
      FROM (
        SELECT *, row_number() OVER (ORDER BY next_due_date) rn
        FROM report_tool_maintenance_due(p_company_id, NULL, NULL, NULL)
        WHERE due_state IN ('overdue','due_soon') OR unit_status = 'in_repair'
      ) q
    ),
    'overdue_returns', (
      SELECT jsonb_build_object(
        'count', COUNT(*),
        'items', COALESCE(jsonb_agg(jsonb_build_object(
          'issue_number', i.issue_number, 'tool_name', t.name,
          'issued_to_name', i.issued_to_name, 'job_reference', i.job_reference,
          'expected_return_date', i.expected_return_date,
          'days_overdue', (CURRENT_DATE - i.expected_return_date)
        ) ORDER BY i.expected_return_date), '[]'::jsonb))
      FROM tool_issues i
      JOIN warehouse_tools t ON t.id = i.tool_id
      WHERE i.company_id = p_company_id
        AND i.status IN ('issued','partially_returned')
        AND i.expected_return_date IS NOT NULL
        AND i.expected_return_date < CURRENT_DATE
    )
  ) INTO v;
  RETURN v;
END;
$$;
GRANT EXECUTE ON FUNCTION public.get_tool_due_summary(uuid) TO authenticated;

-- 4. Tool cost report: calibration + maintenance spend rolled up per tool.
CREATE OR REPLACE FUNCTION public.report_tool_cost(
  p_company_id uuid,
  p_date_from date DEFAULT NULL,
  p_date_to date DEFAULT NULL
)
RETURNS TABLE (
  tool_code text, tool_name text,
  calibration_cost numeric, maintenance_cost numeric, total_cost numeric,
  calibration_count bigint, maintenance_count bigint
)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public
AS $$
  WITH cal AS (
    SELECT u.tool_id, SUM(c.cost) cost, COUNT(*) n
    FROM tool_calibrations c JOIN tool_units u ON u.id = c.unit_id
    WHERE c.company_id = p_company_id
      AND (p_date_from IS NULL OR c.calibration_date >= p_date_from)
      AND (p_date_to IS NULL OR c.calibration_date <= p_date_to)
    GROUP BY u.tool_id
  ),
  mnt AS (
    SELECT u.tool_id, SUM(m.cost) cost, COUNT(*) n
    FROM tool_maintenance m JOIN tool_units u ON u.id = m.unit_id
    WHERE m.company_id = p_company_id
      AND (p_date_from IS NULL OR m.maintenance_date >= p_date_from)
      AND (p_date_to IS NULL OR m.maintenance_date <= p_date_to)
    GROUP BY u.tool_id
  )
  SELECT t.tool_code, t.name,
         ROUND(COALESCE(cal.cost,0),2), ROUND(COALESCE(mnt.cost,0),2),
         ROUND(COALESCE(cal.cost,0)+COALESCE(mnt.cost,0),2),
         COALESCE(cal.n,0), COALESCE(mnt.n,0)
  FROM warehouse_tools t
  LEFT JOIN cal ON cal.tool_id = t.id
  LEFT JOIN mnt ON mnt.tool_id = t.id
  WHERE t.company_id = p_company_id
    AND (COALESCE(cal.cost,0) > 0 OR COALESCE(mnt.cost,0) > 0)
  ORDER BY (COALESCE(cal.cost,0)+COALESCE(mnt.cost,0)) DESC
  LIMIT 50000;
$$;
GRANT EXECUTE ON FUNCTION public.report_tool_cost(uuid, date, date) TO authenticated;
