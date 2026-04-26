CREATE TABLE IF NOT EXISTS public.report_audit_log (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  report_code TEXT NOT NULL,
  report_title TEXT NOT NULL,
  module_key TEXT NOT NULL,
  format TEXT NOT NULL CHECK (format IN ('xlsx','pdf','csv','preview')),
  params JSONB NOT NULL DEFAULT '{}'::jsonb,
  row_count INTEGER NOT NULL DEFAULT 0,
  company_id UUID,
  generated_by UUID NOT NULL DEFAULT auth.uid(),
  generated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  user_agent TEXT
);

CREATE INDEX IF NOT EXISTS idx_report_audit_log_user ON public.report_audit_log (generated_by, generated_at DESC);
CREATE INDEX IF NOT EXISTS idx_report_audit_log_company ON public.report_audit_log (company_id, generated_at DESC);
CREATE INDEX IF NOT EXISTS idx_report_audit_log_code ON public.report_audit_log (report_code, generated_at DESC);

ALTER TABLE public.report_audit_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users insert own report audit rows" ON public.report_audit_log;
CREATE POLICY "Users insert own report audit rows"
  ON public.report_audit_log
  FOR INSERT
  TO authenticated
  WITH CHECK (generated_by = auth.uid());

DROP POLICY IF EXISTS "Users view own or company audit rows" ON public.report_audit_log;
CREATE POLICY "Users view own or company audit rows"
  ON public.report_audit_log
  FOR SELECT
  TO authenticated
  USING (
    generated_by = auth.uid()
    OR (
      (
        public.has_role(auth.uid(), 'admin'::app_role)
        OR public.has_role(auth.uid(), 'super_admin'::app_role)
        OR public.has_role(auth.uid(), 'manager'::app_role)
      )
      AND (company_id IS NULL OR public.can_access_company(company_id))
    )
  );

CREATE OR REPLACE FUNCTION public.report_stock_on_hand(
  p_company_id UUID,
  p_location_id UUID DEFAULT NULL,
  p_category_id UUID DEFAULT NULL,
  p_include_zero BOOLEAN DEFAULT FALSE
)
RETURNS TABLE (
  item_id UUID,
  item_code TEXT,
  item_name TEXT,
  category_id UUID,
  category_name TEXT,
  location_id UUID,
  location_name TEXT,
  unit_name TEXT,
  current_stock NUMERIC,
  reserved_quantity NUMERIC,
  available_quantity NUMERIC,
  unit_cost NUMERIC,
  stock_value NUMERIC,
  min_stock_level NUMERIC,
  reorder_level NUMERIC,
  status TEXT
)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT
    wi.id,
    wi.item_code,
    wi.name,
    wi.category_id,
    ic.name,
    wi.location_id,
    wl.name,
    iu.name,
    COALESCE(wi.current_stock, 0)::NUMERIC,
    COALESCE(wi.reserved_quantity, 0)::NUMERIC,
    COALESCE(wi.available_quantity, 0)::NUMERIC,
    COALESCE(wi.unit_cost, 0)::NUMERIC,
    (COALESCE(wi.current_stock, 0) * COALESCE(wi.unit_cost, 0))::NUMERIC,
    COALESCE(wi.min_stock_level, 0)::NUMERIC,
    COALESCE(wi.reorder_level, 0)::NUMERIC,
    wi.status
  FROM public.warehouse_items wi
  LEFT JOIN public.item_categories ic ON ic.id = wi.category_id
  LEFT JOIN public.warehouse_locations wl ON wl.id = wi.location_id
  LEFT JOIN public.item_units iu ON iu.id = wi.unit_id
  WHERE wi.company_id = p_company_id
    AND (p_location_id IS NULL OR wi.location_id = p_location_id)
    AND (p_category_id IS NULL OR wi.category_id = p_category_id)
    AND (p_include_zero OR COALESCE(wi.current_stock, 0) > 0)
  ORDER BY wi.item_code;
$$;

CREATE OR REPLACE FUNCTION public.report_inventory_valuation(
  p_company_id UUID,
  p_as_of_date TIMESTAMPTZ DEFAULT now(),
  p_category_id UUID DEFAULT NULL
)
RETURNS TABLE (
  item_id UUID,
  item_code TEXT,
  item_name TEXT,
  category_name TEXT,
  unit_name TEXT,
  current_stock NUMERIC,
  weighted_avg_cost NUMERIC,
  weighted_avg_value NUMERIC,
  fifo_value NUMERIC,
  last_unit_cost NUMERIC,
  selling_price NUMERIC,
  nrv_adjustment NUMERIC
)
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  WITH receipts AS (
    SELECT
      st.item_id,
      st.created_at,
      st.quantity_change::NUMERIC AS qty,
      COALESCE(st.unit_cost, 0)::NUMERIC AS unit_cost
    FROM public.stock_transactions st
    JOIN public.warehouse_items wi ON wi.id = st.item_id
    WHERE wi.company_id = p_company_id
      AND st.created_at <= p_as_of_date
      AND st.quantity_change > 0
  ),
  wavg AS (
    SELECT
      r.item_id,
      CASE WHEN SUM(r.qty) > 0 THEN SUM(r.qty * r.unit_cost) / SUM(r.qty) ELSE 0 END AS wavg_cost
    FROM receipts r
    GROUP BY r.item_id
  ),
  ranked AS (
    SELECT
      r.item_id,
      r.created_at,
      r.qty,
      r.unit_cost,
      SUM(r.qty) OVER (PARTITION BY r.item_id ORDER BY r.created_at DESC ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW) AS cum_qty
    FROM receipts r
  ),
  stock_lookup AS (
    SELECT id AS item_id, COALESCE(current_stock, 0)::NUMERIC AS current_stock
    FROM public.warehouse_items
    WHERE company_id = p_company_id
  ),
  fifo AS (
    SELECT
      r.item_id,
      SUM(
        LEAST(
          r.qty,
          GREATEST(0::NUMERIC, sl.current_stock - (r.cum_qty - r.qty))
        ) * r.unit_cost
      ) AS fifo_val
    FROM ranked r
    JOIN stock_lookup sl ON sl.item_id = r.item_id
    WHERE (r.cum_qty - r.qty) < sl.current_stock
    GROUP BY r.item_id
  ),
  last_cost AS (
    SELECT DISTINCT ON (r.item_id) r.item_id, r.unit_cost
    FROM receipts r
    ORDER BY r.item_id, r.created_at DESC
  )
  SELECT
    wi.id,
    wi.item_code,
    wi.name,
    ic.name,
    iu.name,
    COALESCE(wi.current_stock, 0)::NUMERIC,
    COALESCE(w.wavg_cost, wi.unit_cost, 0)::NUMERIC,
    (COALESCE(wi.current_stock, 0) * COALESCE(w.wavg_cost, wi.unit_cost, 0))::NUMERIC,
    COALESCE(f.fifo_val, COALESCE(wi.current_stock, 0) * COALESCE(wi.unit_cost, 0))::NUMERIC,
    COALESCE(l.unit_cost, wi.unit_cost, 0)::NUMERIC,
    COALESCE(wi.selling_price, 0)::NUMERIC,
    (GREATEST(0::NUMERIC, COALESCE(w.wavg_cost, wi.unit_cost, 0) - COALESCE(wi.selling_price, 0)) * COALESCE(wi.current_stock, 0))::NUMERIC
  FROM public.warehouse_items wi
  LEFT JOIN public.item_categories ic ON ic.id = wi.category_id
  LEFT JOIN public.item_units iu ON iu.id = wi.unit_id
  LEFT JOIN wavg w ON w.item_id = wi.id
  LEFT JOIN fifo f ON f.item_id = wi.id
  LEFT JOIN last_cost l ON l.item_id = wi.id
  WHERE wi.company_id = p_company_id
    AND (p_category_id IS NULL OR wi.category_id = p_category_id)
    AND COALESCE(wi.current_stock, 0) > 0
  ORDER BY wi.item_code;
END;
$$;

CREATE OR REPLACE FUNCTION public.report_inventory_aging(
  p_company_id UUID,
  p_category_id UUID DEFAULT NULL
)
RETURNS TABLE (
  item_id UUID,
  item_code TEXT,
  item_name TEXT,
  category_name TEXT,
  current_stock NUMERIC,
  unit_cost NUMERIC,
  stock_value NUMERIC,
  last_movement_at TIMESTAMPTZ,
  days_since_movement INTEGER,
  aging_bucket TEXT
)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  WITH last_mov AS (
    SELECT st.item_id, MAX(st.created_at) AS last_at
    FROM public.stock_transactions st
    JOIN public.warehouse_items wi ON wi.id = st.item_id
    WHERE wi.company_id = p_company_id
    GROUP BY st.item_id
  )
  SELECT
    wi.id,
    wi.item_code,
    wi.name,
    ic.name,
    COALESCE(wi.current_stock, 0)::NUMERIC,
    COALESCE(wi.unit_cost, 0)::NUMERIC,
    (COALESCE(wi.current_stock, 0) * COALESCE(wi.unit_cost, 0))::NUMERIC,
    lm.last_at,
    CASE WHEN lm.last_at IS NULL THEN NULL
         ELSE EXTRACT(DAY FROM (now() - lm.last_at))::INTEGER END,
    CASE
      WHEN lm.last_at IS NULL THEN 'No Movement'
      WHEN now() - lm.last_at <= INTERVAL '30 days' THEN '0-30 days'
      WHEN now() - lm.last_at <= INTERVAL '60 days' THEN '31-60 days'
      WHEN now() - lm.last_at <= INTERVAL '90 days' THEN '61-90 days'
      WHEN now() - lm.last_at <= INTERVAL '180 days' THEN '91-180 days'
      WHEN now() - lm.last_at <= INTERVAL '365 days' THEN '181-365 days'
      ELSE '365+ days (Dead Stock)'
    END
  FROM public.warehouse_items wi
  LEFT JOIN public.item_categories ic ON ic.id = wi.category_id
  LEFT JOIN last_mov lm ON lm.item_id = wi.id
  WHERE wi.company_id = p_company_id
    AND (p_category_id IS NULL OR wi.category_id = p_category_id)
    AND COALESCE(wi.current_stock, 0) > 0
  ORDER BY (CASE WHEN lm.last_at IS NULL THEN 999999 ELSE EXTRACT(DAY FROM (now() - lm.last_at))::INTEGER END) DESC;
$$;