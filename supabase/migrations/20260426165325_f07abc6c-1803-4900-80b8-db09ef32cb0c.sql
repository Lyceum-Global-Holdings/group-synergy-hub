
-- ============================================================
-- Reports Center Phase 2: 8 warehouse report RPCs
-- All SECURITY INVOKER, read-only, return flat rows for the
-- Reports Center envelope. Honour existing RLS via invoker.
-- ============================================================

-- 1. Stock Movement Ledger
CREATE OR REPLACE FUNCTION public.report_stock_movement_ledger(
  p_company_id uuid,
  p_date_from timestamptz DEFAULT NULL,
  p_date_to timestamptz DEFAULT NULL,
  p_location_id uuid DEFAULT NULL
)
RETURNS TABLE (
  txn_date timestamptz,
  item_code text,
  item_name text,
  transaction_type text,
  reference_type text,
  quantity_change numeric,
  quantity_before numeric,
  quantity_after numeric,
  unit_cost numeric,
  total_value numeric,
  location_name text,
  user_email text,
  notes text
)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT
    st.created_at AS txn_date,
    wi.item_code,
    wi.name AS item_name,
    st.transaction_type::text,
    st.reference_type::text,
    st.quantity_change,
    st.quantity_before,
    st.quantity_after,
    st.unit_cost,
    st.total_value,
    wl.name AS location_name,
    p.email AS user_email,
    st.notes
  FROM stock_transactions st
  JOIN warehouse_items wi ON wi.id = st.item_id
  LEFT JOIN warehouse_locations wl ON wl.id = wi.location_id
  LEFT JOIN profiles p ON p.id = st.created_by
  WHERE st.company_id = p_company_id
    AND (p_date_from IS NULL OR st.created_at >= p_date_from)
    AND (p_date_to IS NULL OR st.created_at <= p_date_to)
    AND (p_location_id IS NULL OR wi.location_id = p_location_id)
  ORDER BY st.created_at DESC
  LIMIT 50000;
$$;

-- 2. ABC / Pareto Classification (12-month consumption value)
CREATE OR REPLACE FUNCTION public.report_abc_classification(
  p_company_id uuid,
  p_months integer DEFAULT 12,
  p_category_id uuid DEFAULT NULL
)
RETURNS TABLE (
  item_code text,
  item_name text,
  category_name text,
  consumption_qty numeric,
  consumption_value numeric,
  cumulative_pct numeric,
  abc_class text
)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  WITH consumption AS (
    SELECT
      wi.id,
      wi.item_code,
      wi.name AS item_name,
      ic.name AS category_name,
      COALESCE(SUM(ABS(st.quantity_change)) FILTER (
        WHERE st.transaction_type IN ('material_issue','project_issue','transfer_out')
      ), 0) AS consumption_qty,
      COALESCE(SUM(ABS(COALESCE(st.total_value, st.quantity_change * COALESCE(st.unit_cost, wi.unit_cost, 0)))) FILTER (
        WHERE st.transaction_type IN ('material_issue','project_issue','transfer_out')
      ), 0) AS consumption_value
    FROM warehouse_items wi
    LEFT JOIN item_categories ic ON ic.id = wi.category_id
    LEFT JOIN stock_transactions st
      ON st.item_id = wi.id
     AND st.created_at >= now() - make_interval(months => p_months)
    WHERE wi.company_id = p_company_id
      AND (p_category_id IS NULL OR wi.category_id = p_category_id)
    GROUP BY wi.id, wi.item_code, wi.name, ic.name
  ),
  ranked AS (
    SELECT
      item_code, item_name, category_name,
      consumption_qty, consumption_value,
      CASE WHEN SUM(consumption_value) OVER () = 0 THEN 0
           ELSE 100.0 * SUM(consumption_value) OVER (
             ORDER BY consumption_value DESC, item_code
             ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW
           ) / SUM(consumption_value) OVER ()
      END AS cumulative_pct
    FROM consumption
  )
  SELECT
    item_code, item_name, category_name,
    consumption_qty, consumption_value,
    ROUND(cumulative_pct::numeric, 2) AS cumulative_pct,
    CASE
      WHEN cumulative_pct <= 80 THEN 'A'
      WHEN cumulative_pct <= 95 THEN 'B'
      ELSE 'C'
    END AS abc_class
  FROM ranked
  ORDER BY consumption_value DESC, item_code
  LIMIT 50000;
$$;

-- 3. Cycle Count Variance
CREATE OR REPLACE FUNCTION public.report_cycle_count_variance(
  p_company_id uuid,
  p_date_from date DEFAULT NULL,
  p_date_to date DEFAULT NULL,
  p_location_id uuid DEFAULT NULL
)
RETURNS TABLE (
  count_number text,
  count_date date,
  status text,
  location_name text,
  item_code text,
  item_name text,
  system_quantity numeric,
  physical_quantity numeric,
  variance_quantity numeric,
  variance_value numeric,
  variance_percentage numeric,
  variance_reason text
)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT
    cc.count_number,
    cc.count_date,
    cc.status,
    wl.name AS location_name,
    wi.item_code,
    wi.name AS item_name,
    cci.system_quantity,
    cci.physical_quantity,
    cci.variance_quantity,
    cci.variance_value,
    cci.variance_percentage,
    cci.variance_reason
  FROM cycle_counts cc
  JOIN cycle_count_items cci ON cci.cycle_count_id = cc.id
  JOIN warehouse_items wi ON wi.id = cci.warehouse_item_id
  LEFT JOIN warehouse_locations wl ON wl.id = cc.location_id
  WHERE cc.company_id = p_company_id
    AND (p_date_from IS NULL OR cc.count_date >= p_date_from)
    AND (p_date_to IS NULL OR cc.count_date <= p_date_to)
    AND (p_location_id IS NULL OR cc.location_id = p_location_id)
    AND COALESCE(cci.variance_quantity, 0) <> 0
  ORDER BY cc.count_date DESC, cc.count_number, wi.item_code
  LIMIT 50000;
$$;

-- 4. Bin Utilisation
CREATE OR REPLACE FUNCTION public.report_bin_utilisation(
  p_company_id uuid,
  p_location_id uuid DEFAULT NULL
)
RETURNS TABLE (
  bin_code text,
  bin_name text,
  location_name text,
  capacity numeric,
  current_quantity numeric,
  available_capacity numeric,
  utilisation_pct numeric,
  status text
)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT
    wb.bin_code,
    wb.name AS bin_name,
    wl.name AS location_name,
    wb.capacity,
    wb.current_quantity,
    GREATEST(COALESCE(wb.capacity,0) - COALESCE(wb.current_quantity,0), 0) AS available_capacity,
    CASE WHEN COALESCE(wb.capacity,0) = 0 THEN 0
         ELSE ROUND((100.0 * COALESCE(wb.current_quantity,0) / wb.capacity)::numeric, 2)
    END AS utilisation_pct,
    wb.status
  FROM warehouse_bins wb
  LEFT JOIN warehouse_locations wl ON wl.id = wb.location_id
  WHERE wb.company_id = p_company_id
    AND (p_location_id IS NULL OR wb.location_id = p_location_id)
  ORDER BY utilisation_pct DESC NULLS LAST, wb.bin_code
  LIMIT 50000;
$$;

-- 5. GRN Register
CREATE OR REPLACE FUNCTION public.report_grn_register(
  p_company_id uuid,
  p_date_from date DEFAULT NULL,
  p_date_to date DEFAULT NULL,
  p_supplier_id uuid DEFAULT NULL
)
RETURNS TABLE (
  grn_number text,
  grn_date date,
  po_number text,
  invoice_number text,
  invoice_date date,
  supplier_name text,
  status text,
  total_value numeric,
  line_count bigint,
  total_qty_received numeric,
  approved_at timestamptz,
  remarks text
)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT
    g.grn_number,
    g.grn_date,
    g.po_number,
    g.invoice_number,
    g.invoice_date,
    g.supplier_name,
    g.status,
    g.total_value,
    COUNT(gi.id) AS line_count,
    COALESCE(SUM(gi.quantity_received), 0) AS total_qty_received,
    g.approved_date AS approved_at,
    g.remarks
  FROM goods_receipt_notes g
  LEFT JOIN grn_items gi ON gi.grn_id = g.id
  WHERE g.company_id = p_company_id
    AND (p_date_from IS NULL OR g.grn_date >= p_date_from)
    AND (p_date_to IS NULL OR g.grn_date <= p_date_to)
    AND (p_supplier_id IS NULL OR g.supplier_id = p_supplier_id)
  GROUP BY g.id
  ORDER BY g.grn_date DESC, g.grn_number
  LIMIT 50000;
$$;

-- 6. Asset Register (IAS 16)
CREATE OR REPLACE FUNCTION public.report_asset_register(
  p_company_id uuid,
  p_location_id uuid DEFAULT NULL,
  p_status text DEFAULT NULL
)
RETURNS TABLE (
  asset_id text,
  name text,
  category text,
  brand text,
  serial_number text,
  asset_tag text,
  location_name text,
  status text,
  condition text,
  purchase_date date,
  purchase_price numeric,
  depreciation_method text,
  depreciation_rate numeric,
  useful_life_years integer,
  salvage_value numeric,
  accumulated_depreciation numeric,
  net_book_value numeric
)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT
    wa.asset_id,
    wa.name,
    COALESCE(ic.name, wa.category) AS category,
    wa.brand,
    wa.serial_number,
    wa.asset_tag,
    wl.name AS location_name,
    wa.status,
    wa.condition,
    wa.purchase_date,
    wa.purchase_price,
    wa.depreciation_method,
    wa.depreciation_rate,
    wa.useful_life_years,
    wa.salvage_value,
    COALESCE(wa.accumulated_depreciation, 0) AS accumulated_depreciation,
    GREATEST(
      COALESCE(wa.purchase_price, 0) - COALESCE(wa.accumulated_depreciation, 0),
      COALESCE(wa.salvage_value, 0)
    ) AS net_book_value
  FROM warehouse_assets wa
  LEFT JOIN warehouse_locations wl ON wl.id = wa.location_id
  LEFT JOIN item_categories ic ON ic.id = wa.category_id
  WHERE wa.company_id = p_company_id
    AND (p_location_id IS NULL OR wa.location_id = p_location_id)
    AND (p_status IS NULL OR wa.status = p_status)
  ORDER BY wa.name, wa.asset_id
  LIMIT 50000;
$$;

-- 7. Tool Issue / Return Ledger
CREATE OR REPLACE FUNCTION public.report_tool_ledger(
  p_company_id uuid,
  p_date_from date DEFAULT NULL,
  p_date_to date DEFAULT NULL,
  p_status text DEFAULT NULL
)
RETURNS TABLE (
  issue_number text,
  issue_date date,
  tool_code text,
  tool_name text,
  issued_to_name text,
  department text,
  expected_return_date date,
  quantity_issued integer,
  quantity_returned integer,
  outstanding_qty integer,
  status text,
  last_return_date date,
  last_condition text,
  purpose text
)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  WITH last_returns AS (
    SELECT DISTINCT ON (issue_id)
      issue_id, return_date, condition
    FROM tool_returns
    ORDER BY issue_id, return_date DESC
  )
  SELECT
    ti.issue_number,
    ti.issue_date,
    COALESCE(ti.tool_code_snapshot, wt.tool_code) AS tool_code,
    COALESCE(ti.tool_name_snapshot, wt.name) AS tool_name,
    ti.issued_to_name,
    ti.department,
    ti.expected_return_date,
    ti.quantity_issued,
    COALESCE(ti.quantity_returned, 0) AS quantity_returned,
    GREATEST(COALESCE(ti.quantity_issued,0) - COALESCE(ti.quantity_returned,0), 0) AS outstanding_qty,
    ti.status,
    lr.return_date AS last_return_date,
    lr.condition AS last_condition,
    ti.purpose
  FROM tool_issues ti
  LEFT JOIN warehouse_tools wt ON wt.id = ti.tool_id
  LEFT JOIN last_returns lr ON lr.issue_id = ti.id
  WHERE ti.company_id = p_company_id
    AND (p_date_from IS NULL OR ti.issue_date >= p_date_from)
    AND (p_date_to IS NULL OR ti.issue_date <= p_date_to)
    AND (p_status IS NULL OR ti.status = p_status)
  ORDER BY ti.issue_date DESC, ti.issue_number
  LIMIT 50000;
$$;

-- 8. Batch Traceability (forward + backward)
CREATE OR REPLACE FUNCTION public.report_batch_traceability(
  p_company_id uuid,
  p_batch_number text DEFAULT NULL,
  p_item_code text DEFAULT NULL,
  p_direction text DEFAULT 'both'
)
RETURNS TABLE (
  trace_direction text,
  event_date timestamptz,
  event_type text,
  reference_number text,
  batch_number text,
  item_code text,
  item_name text,
  quantity numeric,
  unit_cost numeric,
  counterparty text,
  notes text
)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  WITH target AS (
    SELECT ib.id AS batch_id, ib.batch_number, ib.warehouse_item_id, ib.grn_item_id,
           wi.item_code, wi.name AS item_name
    FROM item_batches ib
    JOIN warehouse_items wi ON wi.id = ib.warehouse_item_id
    WHERE ib.company_id = p_company_id
      AND (
        (p_batch_number IS NOT NULL AND ib.batch_number = p_batch_number)
        OR (p_item_code IS NOT NULL AND wi.item_code = p_item_code)
      )
  ),
  upstream AS (
    SELECT
      'backward'::text AS trace_direction,
      g.grn_date::timestamptz AS event_date,
      'GRN Receipt'::text AS event_type,
      g.grn_number AS reference_number,
      t.batch_number,
      t.item_code,
      t.item_name,
      gi.quantity_received AS quantity,
      gi.unit_price AS unit_cost,
      g.supplier_name AS counterparty,
      gi.remarks AS notes
    FROM target t
    JOIN grn_items gi ON gi.id = t.grn_item_id
    JOIN goods_receipt_notes g ON g.id = gi.grn_id
  ),
  downstream AS (
    SELECT
      'forward'::text AS trace_direction,
      st.created_at AS event_date,
      st.transaction_type::text AS event_type,
      COALESCE(st.notes, st.id::text) AS reference_number,
      t.batch_number,
      t.item_code,
      t.item_name,
      st.quantity_change AS quantity,
      st.unit_cost,
      wl.name AS counterparty,
      st.notes
    FROM target t
    JOIN stock_transactions st ON st.batch_id = t.batch_id
    LEFT JOIN warehouse_locations wl ON wl.id = st.issued_to_location_id
  )
  SELECT * FROM upstream
    WHERE p_direction IN ('backward','both')
  UNION ALL
  SELECT * FROM downstream
    WHERE p_direction IN ('forward','both')
  ORDER BY event_date DESC
  LIMIT 50000;
$$;

GRANT EXECUTE ON FUNCTION public.report_stock_movement_ledger(uuid, timestamptz, timestamptz, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.report_abc_classification(uuid, integer, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.report_cycle_count_variance(uuid, date, date, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.report_bin_utilisation(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.report_grn_register(uuid, date, date, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.report_asset_register(uuid, uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.report_tool_ledger(uuid, date, date, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.report_batch_traceability(uuid, text, text, text) TO authenticated;
