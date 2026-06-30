-- Freight / Transport cost reports. Read-only, company-scoped, SECURITY INVOKER
-- (respects RLS). Surfaces goods_receipt_notes.transport_cost (the GRN landed-cost
-- freight line) for visibility. Only GRNs with transport_cost > 0 are included.

-- 1. Summary: freight aggregated by supplier x month.
CREATE OR REPLACE FUNCTION public.report_freight_cost_summary(
  p_company_id uuid,
  p_date_from date DEFAULT NULL,
  p_date_to date DEFAULT NULL,
  p_location_id uuid DEFAULT NULL
)
RETURNS TABLE (
  supplier_id uuid,
  supplier_name text,
  period_month text,
  grn_count bigint,
  total_freight numeric,
  avg_freight numeric
)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT
    g.supplier_id,
    COALESCE(g.supplier_name, '(no supplier)') AS supplier_name,
    to_char(g.grn_date, 'YYYY-MM') AS period_month,
    COUNT(*) AS grn_count,
    ROUND(SUM(g.transport_cost), 2) AS total_freight,
    ROUND(AVG(g.transport_cost), 2) AS avg_freight
  FROM goods_receipt_notes g
  WHERE g.company_id = p_company_id
    AND COALESCE(g.transport_cost, 0) > 0
    AND (p_date_from IS NULL OR g.grn_date >= p_date_from)
    AND (p_date_to IS NULL OR g.grn_date <= p_date_to)
    AND (p_location_id IS NULL OR g.location_id = p_location_id)
  GROUP BY g.supplier_id, COALESCE(g.supplier_name, '(no supplier)'), to_char(g.grn_date, 'YYYY-MM')
  ORDER BY total_freight DESC
  LIMIT 50000;
$$;

-- 2. Register: per-GRN freight drill-down.
CREATE OR REPLACE FUNCTION public.report_freight_register(
  p_company_id uuid,
  p_date_from date DEFAULT NULL,
  p_date_to date DEFAULT NULL,
  p_location_id uuid DEFAULT NULL
)
RETURNS TABLE (
  grn_number text,
  grn_date date,
  supplier_name text,
  po_number text,
  location_name text,
  net_value numeric,
  transport_cost numeric,
  grand_total numeric
)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT
    g.grn_number,
    g.grn_date,
    g.supplier_name,
    g.po_number,
    wl.name AS location_name,
    g.total_value AS net_value,
    g.transport_cost,
    g.grand_total
  FROM goods_receipt_notes g
  LEFT JOIN warehouse_locations wl ON wl.id = g.location_id
  WHERE g.company_id = p_company_id
    AND COALESCE(g.transport_cost, 0) > 0
    AND (p_date_from IS NULL OR g.grn_date >= p_date_from)
    AND (p_date_to IS NULL OR g.grn_date <= p_date_to)
    AND (p_location_id IS NULL OR g.location_id = p_location_id)
  ORDER BY g.grn_date DESC, g.grn_number
  LIMIT 50000;
$$;

GRANT EXECUTE ON FUNCTION public.report_freight_cost_summary(uuid, date, date, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.report_freight_register(uuid, date, date, uuid) TO authenticated;
