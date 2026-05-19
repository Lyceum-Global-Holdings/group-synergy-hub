
-- Warehouse pulse
CREATE OR REPLACE FUNCTION public.get_dashboard_warehouse_pulse(
  p_company_id uuid DEFAULT NULL,
  p_location_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  WITH inv AS (
    SELECT
      COALESCE(SUM(current_stock * COALESCE(unit_cost, 0)), 0) AS on_hand_value,
      COUNT(*) FILTER (
        WHERE current_stock <= COALESCE(NULLIF(reorder_level, 0), min_stock_level, 0)
          AND COALESCE(NULLIF(reorder_level, 0), min_stock_level, 0) > 0
      ) AS low_stock_count,
      COUNT(*) AS sku_count
    FROM warehouse_items
    WHERE (p_company_id IS NULL OR company_id = p_company_id)
      AND (p_location_id IS NULL OR location_id = p_location_id)
  ),
  moves24 AS (
    SELECT COUNT(*) AS c
    FROM stock_transactions
    WHERE created_at >= now() - interval '24 hours'
      AND (p_company_id IS NULL OR company_id = p_company_id)
  ),
  trend AS (
    SELECT jsonb_agg(jsonb_build_object('d', d::date, 'v', COALESCE(c, 0)) ORDER BY d) AS spark
    FROM (
      SELECT day::date AS d,
        (SELECT COUNT(*) FROM stock_transactions s
          WHERE s.created_at::date = day::date
            AND (p_company_id IS NULL OR s.company_id = p_company_id)) AS c
      FROM generate_series(now()::date - 6, now()::date, interval '1 day') AS day
    ) t
  )
  SELECT jsonb_build_object(
    'on_hand_value', inv.on_hand_value,
    'low_stock_count', inv.low_stock_count,
    'sku_count', inv.sku_count,
    'moves_24h', moves24.c,
    'sparkline_7d', COALESCE(trend.spark, '[]'::jsonb)
  )
  FROM inv, moves24, trend;
$$;

-- Procurement pulse
CREATE OR REPLACE FUNCTION public.get_dashboard_procurement_pulse(
  p_company_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  WITH po AS (
    SELECT
      COUNT(*) FILTER (WHERE status IN ('draft','pending_dept_head_approval','approved','sent','partially_received')) AS open_count,
      COUNT(*) FILTER (WHERE status = 'pending_dept_head_approval') AS pending_approval,
      COUNT(*) FILTER (WHERE status = 'approved' AND approved_date::date = now()::date) AS approved_today,
      COALESCE(SUM(final_amount) FILTER (
        WHERE date_trunc('month', po_date) = date_trunc('month', now())
      ), 0) AS spend_mtd,
      COALESCE(SUM(final_amount) FILTER (
        WHERE date_trunc('month', po_date) = date_trunc('month', now() - interval '1 month')
      ), 0) AS spend_last_month
    FROM purchase_orders
    WHERE (p_company_id IS NULL OR company_id = p_company_id)
  ),
  grn AS (
    SELECT COUNT(*) AS pending_grn
    FROM goods_receipt_notes
    WHERE status IN ('draft','submitted')
      AND (p_company_id IS NULL OR company_id = p_company_id)
  ),
  trend AS (
    SELECT jsonb_agg(jsonb_build_object('d', d::date, 'v', COALESCE(c, 0)) ORDER BY d) AS spark
    FROM (
      SELECT day::date AS d,
        (SELECT COUNT(*) FROM purchase_orders p
          WHERE p.created_at::date = day::date
            AND (p_company_id IS NULL OR p.company_id = p_company_id)) AS c
      FROM generate_series(now()::date - 6, now()::date, interval '1 day') AS day
    ) t
  )
  SELECT jsonb_build_object(
    'open_count', po.open_count,
    'pending_approval', po.pending_approval,
    'approved_today', po.approved_today,
    'spend_mtd', po.spend_mtd,
    'spend_last_month', po.spend_last_month,
    'pending_grn', grn.pending_grn,
    'sparkline_7d', COALESCE(trend.spark, '[]'::jsonb)
  )
  FROM po, grn, trend;
$$;

-- Sourcing pulse
CREATE OR REPLACE FUNCTION public.get_dashboard_sourcing_pulse(
  p_company_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  WITH rfq AS (
    SELECT
      COUNT(*) FILTER (WHERE status::text IN ('draft','published','open','in_evaluation')) AS open_count,
      COUNT(*) FILTER (
        WHERE status::text IN ('published','open','in_evaluation')
          AND submission_deadline IS NOT NULL
          AND submission_deadline BETWEEN now() AND now() + interval '7 days'
      ) AS closing_7d,
      COUNT(*) FILTER (WHERE awarded_date::date = now()::date) AS awarded_today
    FROM rfq_rfp_requests
    WHERE (p_company_id IS NULL OR company_id = p_company_id)
  ),
  sup AS (
    SELECT
      COUNT(*) FILTER (WHERE status = 'active') AS active_suppliers,
      COUNT(*) FILTER (WHERE created_at >= now() - interval '30 days') AS new_30d
    FROM suppliers
  )
  SELECT jsonb_build_object(
    'open_rfqs', rfq.open_count,
    'closing_7d', rfq.closing_7d,
    'awarded_today', rfq.awarded_today,
    'active_suppliers', sup.active_suppliers,
    'new_suppliers_30d', sup.new_30d
  )
  FROM rfq, sup;
$$;

-- Finance pulse
CREATE OR REPLACE FUNCTION public.get_dashboard_finance_pulse(
  p_company_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  WITH inv AS (
    SELECT
      COALESCE(SUM(net_amount - COALESCE(amount_paid, 0)) FILTER (
        WHERE status NOT IN ('paid','cancelled','void')
      ), 0) AS outstanding,
      COUNT(*) FILTER (
        WHERE due_date < now()::date
          AND status NOT IN ('paid','cancelled','void')
      ) AS overdue_count,
      COALESCE(SUM(net_amount - COALESCE(amount_paid, 0)) FILTER (
        WHERE due_date < now()::date
          AND status NOT IN ('paid','cancelled','void')
      ), 0) AS overdue_amount
    FROM supplier_invoices
    WHERE (p_company_id IS NULL OR company_id = p_company_id)
  ),
  pay AS (
    SELECT
      COUNT(*) FILTER (WHERE status IN ('pending','draft','approved')) AS pending_payments,
      COALESCE(SUM(total_amount) FILTER (WHERE status IN ('pending','draft','approved')), 0) AS pending_amount
    FROM supplier_payments
    WHERE (p_company_id IS NULL OR company_id = p_company_id)
  )
  SELECT jsonb_build_object(
    'outstanding_payables', inv.outstanding,
    'overdue_invoices', inv.overdue_count,
    'overdue_amount', inv.overdue_amount,
    'pending_payments', pay.pending_payments,
    'pending_payment_amount', pay.pending_amount
  )
  FROM inv, pay;
$$;

-- Health strip (5 headline KPIs)
CREATE OR REPLACE FUNCTION public.get_dashboard_health_strip(
  p_company_id uuid DEFAULT NULL,
  p_location_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  WITH po_today AS (
    SELECT
      COUNT(*) FILTER (WHERE created_at::date = now()::date) AS today,
      COUNT(*) FILTER (WHERE created_at::date = now()::date - 1) AS yesterday
    FROM purchase_orders
    WHERE (p_company_id IS NULL OR company_id = p_company_id)
  ),
  grn_pending AS (
    SELECT COUNT(*) AS c
    FROM goods_receipt_notes
    WHERE status IN ('draft','submitted')
      AND (p_company_id IS NULL OR company_id = p_company_id)
  ),
  low_stock AS (
    SELECT COUNT(*) AS c
    FROM warehouse_items
    WHERE current_stock <= COALESCE(NULLIF(reorder_level, 0), min_stock_level, 0)
      AND COALESCE(NULLIF(reorder_level, 0), min_stock_level, 0) > 0
      AND (p_company_id IS NULL OR company_id = p_company_id)
      AND (p_location_id IS NULL OR location_id = p_location_id)
  ),
  rfqs_open AS (
    SELECT COUNT(*) AS c
    FROM rfq_rfp_requests
    WHERE status::text IN ('draft','published','open','in_evaluation')
      AND (p_company_id IS NULL OR company_id = p_company_id)
  ),
  approvals_pending AS (
    SELECT COUNT(*) AS c
    FROM purchase_orders
    WHERE status = 'pending_dept_head_approval'
      AND (p_company_id IS NULL OR company_id = p_company_id)
  )
  SELECT jsonb_build_object(
    'po_today', po_today.today,
    'po_yesterday', po_today.yesterday,
    'grn_pending', grn_pending.c,
    'low_stock', low_stock.c,
    'rfqs_open', rfqs_open.c,
    'approvals_pending', approvals_pending.c
  )
  FROM po_today, grn_pending, low_stock, rfqs_open, approvals_pending;
$$;

GRANT EXECUTE ON FUNCTION public.get_dashboard_warehouse_pulse(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_dashboard_procurement_pulse(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_dashboard_sourcing_pulse(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_dashboard_finance_pulse(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_dashboard_health_strip(uuid, uuid) TO authenticated;
