
-- =========================================================================
-- Phase 6b follow-up: point report/audit functions at warehouse_items_full
-- The mirrored master columns (item_code, name, unit_id, category_id, ...)
-- were dropped from warehouse_items; they now live in warehouse_item_catalog
-- and are exposed via the warehouse_items_full view.
--
-- Audit (must return 0 rows after this migration):
--   SELECT proname FROM pg_proc p
--   JOIN pg_namespace n ON p.pronamespace=n.oid
--   WHERE n.nspname='public'
--     AND pg_get_functiondef(p.oid) ~ 'warehouse_items\s+wi'
--     AND pg_get_functiondef(p.oid) ~ 'wi\.(item_code|name|category_id|unit_id|brand|manufacturer|barcode|sku)';
-- =========================================================================

-- ---------------- stock_audit_summary ----------------
CREATE OR REPLACE FUNCTION public.stock_audit_summary(p_company_id uuid DEFAULT NULL::uuid)
 RETURNS TABLE(id uuid, item_code text, name text, current_stock numeric, bin_total numeric, bin_count integer, variance numeric, status text)
 LANGUAGE sql
 STABLE
 SET search_path TO 'public'
AS $function$
  select
    wi.id,
    wi.item_code,
    wi.name,
    coalesce(wi.current_stock, 0) as current_stock,
    coalesce(sum(wba.allocated_quantity), 0) as bin_total,
    count(wba.id)::int as bin_count,
    coalesce(wi.current_stock, 0) - coalesce(sum(wba.allocated_quantity), 0) as variance,
    case
      when count(wba.id) = 0 and coalesce(wi.current_stock, 0) = 0 then 'ok'
      when count(wba.id) = 0 then 'no_bins'
      when abs(coalesce(wi.current_stock, 0) - coalesce(sum(wba.allocated_quantity), 0)) < 0.001 then 'ok'
      else 'desync'
    end as status
  from warehouse_items_full wi
  left join warehouse_bin_allocations wba
    on wba.warehouse_item_id = wi.id
    and (p_company_id is null or wba.company_id = p_company_id)
  where wi.status = 'active'
    and (p_company_id is null or wi.company_id = p_company_id)
  group by wi.id, wi.item_code, wi.name, wi.current_stock
$function$;

-- ---------------- stock_audit_summary_by_location ----------------
CREATE OR REPLACE FUNCTION public.stock_audit_summary_by_location(p_company_id uuid, p_location_id uuid)
 RETURNS TABLE(id uuid, item_code text, name text, current_stock numeric, bin_total numeric, bin_count integer, variance numeric, status text)
 LANGUAGE sql
 STABLE
 SET search_path TO 'public'
AS $function$
  WITH loc_alloc AS (
    SELECT wba.warehouse_item_id AS item_id,
           SUM(wba.allocated_quantity) AS bin_total,
           COUNT(wba.id)::int AS bin_count
    FROM public.warehouse_bin_allocations wba
    JOIN public.warehouse_bins wb ON wb.id = wba.bin_id
    WHERE wb.location_id = p_location_id
      AND wba.company_id = p_company_id
    GROUP BY wba.warehouse_item_id
  )
  SELECT
    wi.id,
    wi.item_code,
    wi.name,
    COALESCE(la.bin_total, 0) AS current_stock,
    COALESCE(la.bin_total, 0) AS bin_total,
    COALESCE(la.bin_count, 0) AS bin_count,
    0::numeric AS variance,
    CASE
      WHEN COALESCE(la.bin_count, 0) = 0 THEN 'no_bins'
      ELSE 'ok'
    END AS status
  FROM public.warehouse_items_full wi
  LEFT JOIN loc_alloc la ON la.item_id = wi.id
  WHERE wi.status = 'active'
    AND wi.company_id = p_company_id
    AND COALESCE(la.bin_total, 0) > 0;
$function$;

-- ---------------- report_stock_on_hand ----------------
CREATE OR REPLACE FUNCTION public.report_stock_on_hand(p_company_id uuid, p_location_id uuid DEFAULT NULL::uuid, p_category_id uuid DEFAULT NULL::uuid, p_include_zero boolean DEFAULT false)
 RETURNS TABLE(item_id uuid, item_code text, item_name text, category_id uuid, category_name text, location_id uuid, location_name text, unit_name text, current_stock numeric, reserved_quantity numeric, available_quantity numeric, unit_cost numeric, stock_value numeric, min_stock_level numeric, reorder_level numeric, status text)
 LANGUAGE sql
 STABLE
 SET search_path TO 'public'
AS $function$
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
  FROM public.warehouse_items_full wi
  LEFT JOIN public.item_categories ic ON ic.id = wi.category_id
  LEFT JOIN public.warehouse_locations wl ON wl.id = wi.location_id
  LEFT JOIN public.item_units iu ON iu.id = wi.unit_id
  WHERE wi.company_id = p_company_id
    AND (p_location_id IS NULL OR wi.location_id = p_location_id)
    AND (p_category_id IS NULL OR wi.category_id = p_category_id)
    AND (p_include_zero OR COALESCE(wi.current_stock, 0) > 0)
  ORDER BY wi.item_code;
$function$;

-- ---------------- report_inventory_valuation ----------------
CREATE OR REPLACE FUNCTION public.report_inventory_valuation(p_company_id uuid, p_as_of_date timestamp with time zone DEFAULT now(), p_category_id uuid DEFAULT NULL::uuid)
 RETURNS TABLE(item_id uuid, item_code text, item_name text, category_name text, unit_name text, current_stock numeric, weighted_avg_cost numeric, weighted_avg_value numeric, fifo_value numeric, last_unit_cost numeric, selling_price numeric, nrv_adjustment numeric)
 LANGUAGE plpgsql
 STABLE
 SET search_path TO 'public'
AS $function$
BEGIN
  RETURN QUERY
  WITH receipts AS (
    SELECT
      st.item_id,
      st.created_at,
      st.quantity_change::NUMERIC AS qty,
      COALESCE(st.unit_cost, 0)::NUMERIC AS unit_cost
    FROM public.stock_transactions st
    JOIN public.warehouse_items_full wi ON wi.id = st.item_id
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
  FROM public.warehouse_items_full wi
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
$function$;

-- ---------------- report_inventory_aging ----------------
CREATE OR REPLACE FUNCTION public.report_inventory_aging(p_company_id uuid, p_category_id uuid DEFAULT NULL::uuid)
 RETURNS TABLE(item_id uuid, item_code text, item_name text, category_name text, current_stock numeric, unit_cost numeric, stock_value numeric, last_movement_at timestamp with time zone, days_since_movement integer, aging_bucket text)
 LANGUAGE sql
 STABLE
 SET search_path TO 'public'
AS $function$
  WITH last_mov AS (
    SELECT st.item_id, MAX(st.created_at) AS last_at
    FROM public.stock_transactions st
    JOIN public.warehouse_items_full wi ON wi.id = st.item_id
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
  FROM public.warehouse_items_full wi
  LEFT JOIN public.item_categories ic ON ic.id = wi.category_id
  LEFT JOIN last_mov lm ON lm.item_id = wi.id
  WHERE wi.company_id = p_company_id
    AND (p_category_id IS NULL OR wi.category_id = p_category_id)
    AND COALESCE(wi.current_stock, 0) > 0
  ORDER BY (CASE WHEN lm.last_at IS NULL THEN 999999 ELSE EXTRACT(DAY FROM (now() - lm.last_at))::INTEGER END) DESC;
$function$;

-- ---------------- report_abc_classification ----------------
CREATE OR REPLACE FUNCTION public.report_abc_classification(p_company_id uuid, p_months integer DEFAULT 12, p_category_id uuid DEFAULT NULL::uuid)
 RETURNS TABLE(item_code text, item_name text, category_name text, consumption_qty numeric, consumption_value numeric, cumulative_pct numeric, abc_class text)
 LANGUAGE sql
 STABLE
 SET search_path TO 'public'
AS $function$
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
    FROM warehouse_items_full wi
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
$function$;

-- ---------------- report_cycle_count_variance ----------------
CREATE OR REPLACE FUNCTION public.report_cycle_count_variance(p_company_id uuid, p_date_from date DEFAULT NULL::date, p_date_to date DEFAULT NULL::date, p_location_id uuid DEFAULT NULL::uuid, p_notes_op text DEFAULT 'contains'::text, p_notes_terms text[] DEFAULT NULL::text[])
 RETURNS TABLE(count_number text, count_date date, status text, location_name text, item_code text, item_name text, system_quantity numeric, physical_quantity numeric, variance_quantity numeric, variance_value numeric, variance_percentage numeric, variance_reason text)
 LANGUAGE plpgsql
 STABLE
 SET search_path TO 'public'
AS $function$
DECLARE
  v_op text := COALESCE(NULLIF(btrim(p_notes_op), ''), 'contains');
  v_terms text[];
  v_first text;
BEGIN
  IF v_op NOT IN ('contains','equals','startsWith','endsWith','notContains') THEN
    RAISE EXCEPTION 'invalid notes operator: %', v_op
      USING ERRCODE = '22023';
  END IF;

  SELECT ARRAY(
    SELECT replace(replace(replace(btrim(t), '\', '\\'), '%', '\%'), '_', '\_')
    FROM unnest(COALESCE(p_notes_terms, ARRAY[]::text[])) AS t
    WHERE btrim(t) <> ''
  ) INTO v_terms;

  IF cardinality(v_terms) > 5 THEN
    v_terms := v_terms[1:5];
  END IF;

  v_first := CASE WHEN cardinality(v_terms) >= 1 THEN v_terms[1] ELSE NULL END;

  RETURN QUERY
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
  JOIN warehouse_items_full wi ON wi.id = cci.warehouse_item_id
  LEFT JOIN warehouse_locations wl ON wl.id = cc.location_id
  WHERE cc.company_id = p_company_id
    AND (p_date_from IS NULL OR cc.count_date >= p_date_from)
    AND (p_date_to IS NULL OR cc.count_date <= p_date_to)
    AND (p_location_id IS NULL OR cc.location_id = p_location_id)
    AND COALESCE(cci.variance_quantity, 0) <> 0
    AND (
      cardinality(v_terms) = 0
      OR CASE v_op
        WHEN 'contains'    THEN (
          SELECT bool_and(cci.variance_reason ILIKE '%' || t || '%' ESCAPE '\')
          FROM unnest(v_terms) AS t
        )
        WHEN 'equals'      THEN lower(btrim(COALESCE(cci.variance_reason,''))) = lower(btrim(v_first))
        WHEN 'startsWith'  THEN cci.variance_reason ILIKE v_first || '%' ESCAPE '\'
        WHEN 'endsWith'    THEN cci.variance_reason ILIKE '%' || v_first ESCAPE '\'
        WHEN 'notContains' THEN cci.variance_reason IS NULL OR NOT (cci.variance_reason ILIKE '%' || v_first || '%' ESCAPE '\')
      END
    )
  ORDER BY cc.count_date DESC, cc.count_number, wi.item_code
  LIMIT 50000;
END;
$function$;

-- ---------------- report_batch_traceability ----------------
CREATE OR REPLACE FUNCTION public.report_batch_traceability(p_company_id uuid, p_batch_number text DEFAULT NULL::text, p_item_code text DEFAULT NULL::text, p_direction text DEFAULT 'both'::text, p_notes_op text DEFAULT 'contains'::text, p_notes_terms text[] DEFAULT NULL::text[])
 RETURNS TABLE(trace_direction text, event_date timestamp with time zone, event_type text, reference_number text, batch_number text, item_code text, item_name text, quantity numeric, unit_cost numeric, counterparty text, notes text)
 LANGUAGE plpgsql
 STABLE
 SET search_path TO 'public'
AS $function$
DECLARE
  v_op text := COALESCE(NULLIF(btrim(p_notes_op), ''), 'contains');
  v_terms text[];
  v_first text;
BEGIN
  IF v_op NOT IN ('contains','equals','startsWith','endsWith','notContains') THEN
    RAISE EXCEPTION 'invalid notes operator: %', v_op
      USING ERRCODE = '22023';
  END IF;

  SELECT ARRAY(
    SELECT replace(replace(replace(btrim(t), '\', '\\'), '%', '\%'), '_', '\_')
    FROM unnest(COALESCE(p_notes_terms, ARRAY[]::text[])) AS t
    WHERE btrim(t) <> ''
  ) INTO v_terms;

  IF cardinality(v_terms) > 5 THEN
    v_terms := v_terms[1:5];
  END IF;

  v_first := CASE WHEN cardinality(v_terms) >= 1 THEN v_terms[1] ELSE NULL END;

  RETURN QUERY
  WITH target AS (
    SELECT ib.id AS batch_id, ib.batch_number, ib.warehouse_item_id, ib.grn_item_id,
           wi.item_code, wi.name AS item_name
    FROM item_batches ib
    JOIN warehouse_items_full wi ON wi.id = ib.warehouse_item_id
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
  ),
  combined AS (
    SELECT * FROM upstream WHERE p_direction IN ('backward','both')
    UNION ALL
    SELECT * FROM downstream WHERE p_direction IN ('forward','both')
  )
  SELECT *
  FROM combined c
  WHERE (
    cardinality(v_terms) = 0
    OR CASE v_op
      WHEN 'contains'    THEN (
        SELECT bool_and(c.notes ILIKE '%' || t || '%' ESCAPE '\')
        FROM unnest(v_terms) AS t
      )
      WHEN 'equals'      THEN lower(btrim(COALESCE(c.notes,''))) = lower(btrim(v_first))
      WHEN 'startsWith'  THEN c.notes ILIKE v_first || '%' ESCAPE '\'
      WHEN 'endsWith'    THEN c.notes ILIKE '%' || v_first ESCAPE '\'
      WHEN 'notContains' THEN c.notes IS NULL OR NOT (c.notes ILIKE '%' || v_first || '%' ESCAPE '\')
    END
  )
  ORDER BY event_date DESC
  LIMIT 50000;
END;
$function$;

-- ---------------- report_stock_movement_ledger ----------------
CREATE OR REPLACE FUNCTION public.report_stock_movement_ledger(p_company_id uuid, p_date_from timestamp with time zone DEFAULT NULL::timestamp with time zone, p_date_to timestamp with time zone DEFAULT NULL::timestamp with time zone, p_location_id uuid DEFAULT NULL::uuid, p_notes_op text DEFAULT 'contains'::text, p_notes_terms text[] DEFAULT NULL::text[])
 RETURNS TABLE(txn_date timestamp with time zone, item_code text, item_name text, transaction_type text, reference_type text, quantity_change numeric, quantity_before numeric, quantity_after numeric, unit_cost numeric, total_value numeric, location_name text, user_email text, notes text)
 LANGUAGE plpgsql
 STABLE
 SET search_path TO 'public'
AS $function$
DECLARE
  v_op    text := COALESCE(NULLIF(btrim(p_notes_op), ''), 'contains');
  v_terms text[];
  v_first text;
BEGIN
  IF v_op NOT IN ('contains','equals','startsWith','endsWith','notContains') THEN
    RAISE EXCEPTION 'invalid notes operator: %', v_op
      USING ERRCODE = '22023';
  END IF;

  SELECT ARRAY(
    SELECT replace(replace(replace(btrim(t), '\', '\\'), '%', '\%'), '_', '\_')
    FROM unnest(COALESCE(p_notes_terms, ARRAY[]::text[])) AS t
    WHERE btrim(t) <> ''
  ) INTO v_terms;

  IF cardinality(v_terms) > 5 THEN
    v_terms := v_terms[1:5];
  END IF;

  v_first := CASE WHEN cardinality(v_terms) >= 1 THEN v_terms[1] ELSE NULL END;

  RETURN QUERY
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
  FROM public.stock_transactions st
  JOIN public.warehouse_items_full wi
    ON wi.id = st.item_id
  LEFT JOIN public.warehouse_locations wl
    ON wl.id = wi.location_id
  LEFT JOIN public.profiles p
    ON p.id = st.created_by
  WHERE COALESCE(st.company_id, wi.company_id) = p_company_id
    AND (p_date_from  IS NULL OR st.created_at >= p_date_from)
    AND (p_date_to    IS NULL OR st.created_at <= p_date_to)
    AND (p_location_id IS NULL OR wi.location_id = p_location_id)
    AND (
      cardinality(v_terms) = 0
      OR CASE v_op
        WHEN 'contains'    THEN (
          SELECT bool_and(st.notes ILIKE '%' || t || '%' ESCAPE '\')
          FROM unnest(v_terms) AS t
        )
        WHEN 'equals'      THEN lower(btrim(COALESCE(st.notes,''))) = lower(btrim(v_first))
        WHEN 'startsWith'  THEN st.notes ILIKE v_first || '%' ESCAPE '\'
        WHEN 'endsWith'    THEN st.notes ILIKE '%' || v_first ESCAPE '\'
        WHEN 'notContains' THEN st.notes IS NULL OR NOT (st.notes ILIKE '%' || v_first || '%' ESCAPE '\')
      END
    )
  ORDER BY st.created_at DESC
  LIMIT 50000;
END;
$function$;

-- ---------------- reconcile_stock_batch (4-arg) ----------------
CREATE OR REPLACE FUNCTION public.reconcile_stock_batch(p_item_ids uuid[], p_company_id uuid, p_overrides jsonb DEFAULT '{}'::jsonb, p_user_id uuid DEFAULT NULL::uuid)
 RETURNS TABLE(item_id uuid, item_code text, action text, message text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_item_id uuid;
  v_item_code text;
  v_current_stock numeric;
  v_location_id uuid;
  v_alloc_total numeric;
  v_alloc_id uuid;
  v_diff numeric;
  v_override_location_id uuid;
  v_override_bin_id uuid;
  v_bin_id uuid;
  v_override jsonb;
BEGIN
  FOREACH v_item_id IN ARRAY p_item_ids
  LOOP
    SELECT wi.item_code, wi.current_stock, wi.location_id
    INTO v_item_code, v_current_stock, v_location_id
    FROM warehouse_items_full wi
    WHERE wi.id = v_item_id;

    IF v_item_code IS NULL THEN
      item_id := v_item_id;
      item_code := 'UNKNOWN';
      action := 'error';
      message := 'Item not found';
      RETURN NEXT;
      CONTINUE;
    END IF;

    v_override := p_overrides -> v_item_id::text;
    v_override_location_id := NULL;
    v_override_bin_id := NULL;

    IF v_override IS NOT NULL AND v_override != 'null'::jsonb THEN
      v_override_location_id := (v_override ->> 'locationId')::uuid;
      v_override_bin_id := (v_override ->> 'binId')::uuid;

      IF v_override_location_id IS NOT NULL AND (v_location_id IS NULL OR v_location_id != v_override_location_id) THEN
        UPDATE warehouse_items SET location_id = v_override_location_id WHERE id = v_item_id;
        v_location_id := v_override_location_id;
      END IF;
    END IF;

    SELECT COALESCE(SUM(wba.allocated_quantity), 0)
    INTO v_alloc_total
    FROM warehouse_bin_allocations wba
    WHERE wba.warehouse_item_id = v_item_id
      AND wba.company_id = p_company_id;

    SELECT wba.id INTO v_alloc_id
    FROM warehouse_bin_allocations wba
    WHERE wba.warehouse_item_id = v_item_id
      AND wba.company_id = p_company_id
    ORDER BY wba.allocated_quantity DESC
    LIMIT 1;

    v_diff := v_current_stock - v_alloc_total;

    IF v_diff = 0 THEN
      item_id := v_item_id;
      item_code := v_item_code;
      action := 'ok';
      message := 'Already in sync (stock=' || v_current_stock || ')';
      RETURN NEXT;
      CONTINUE;
    END IF;

    IF v_alloc_id IS NOT NULL THEN
      UPDATE warehouse_bin_allocations
      SET allocated_quantity = GREATEST(0, allocated_quantity + v_diff)
      WHERE id = v_alloc_id;

      item_id := v_item_id;
      item_code := v_item_code;
      action := 'adjusted';
      message := 'Adjusted allocation by ' || v_diff || ' (stock=' || v_current_stock || ', was_alloc=' || v_alloc_total || ')';
      RETURN NEXT;
      CONTINUE;
    END IF;

    v_bin_id := v_override_bin_id;

    IF v_bin_id IS NULL AND v_location_id IS NOT NULL THEN
      SELECT wb.id INTO v_bin_id
      FROM warehouse_bins wb
      WHERE wb.location_id = v_location_id
        AND wb.status = 'active'
      ORDER BY wb.bin_code ASC
      LIMIT 1;
    END IF;

    IF v_bin_id IS NULL THEN
      item_id := v_item_id;
      item_code := v_item_code;
      action := 'blocked';
      message := 'No location/bin available (stock=' || v_current_stock || ')';
      RETURN NEXT;
      CONTINUE;
    END IF;

    INSERT INTO warehouse_bin_allocations (
      warehouse_item_id, bin_id, allocated_quantity, company_id
    ) VALUES (
      v_item_id, v_bin_id, GREATEST(0, v_current_stock), p_company_id
    );

    item_id := v_item_id;
    item_code := v_item_code;
    action := 'created';
    message := 'Created allocation with qty=' || GREATEST(0, v_current_stock);
    RETURN NEXT;
  END LOOP;
END;
$function$;

-- ---------------- reconcile_stock_batch (5-arg, location-scoped) ----------------
CREATE OR REPLACE FUNCTION public.reconcile_stock_batch(p_item_ids uuid[], p_company_id uuid, p_overrides jsonb DEFAULT '{}'::jsonb, p_user_id uuid DEFAULT NULL::uuid, p_location_id uuid DEFAULT NULL::uuid)
 RETURNS TABLE(item_id uuid, item_code text, action text, message text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_item_id uuid;
  v_item_code text;
  v_current_stock numeric;
  v_location_id uuid;
  v_alloc_total numeric;
  v_alloc_id uuid;
  v_diff numeric;
  v_override_location_id uuid;
  v_override_bin_id uuid;
  v_bin_id uuid;
  v_override jsonb;
  v_loc_stock numeric;
  v_loc_alloc_total numeric;
BEGIN
  FOREACH v_item_id IN ARRAY p_item_ids
  LOOP
    SELECT wi.item_code, wi.current_stock, wi.location_id
      INTO v_item_code, v_current_stock, v_location_id
    FROM warehouse_items_full wi
    WHERE wi.id = v_item_id;

    IF v_item_code IS NULL THEN
      item_id := v_item_id; item_code := 'UNKNOWN'; action := 'error'; message := 'Item not found';
      RETURN NEXT; CONTINUE;
    END IF;

    v_override := p_overrides -> v_item_id::text;
    v_override_location_id := NULL;
    v_override_bin_id := NULL;

    IF v_override IS NOT NULL AND v_override != 'null'::jsonb THEN
      v_override_location_id := (v_override ->> 'locationId')::uuid;
      v_override_bin_id := (v_override ->> 'binId')::uuid;
    END IF;

    IF p_location_id IS NOT NULL THEN
      SELECT COALESCE(SUM(wba.allocated_quantity), 0)
        INTO v_loc_alloc_total
      FROM warehouse_bin_allocations wba
      JOIN warehouse_bins wb ON wb.id = wba.bin_id
      WHERE wba.warehouse_item_id = v_item_id
        AND wba.company_id = p_company_id
        AND wb.location_id = p_location_id;

      v_loc_stock := v_loc_alloc_total;

      SELECT wba.id INTO v_alloc_id
      FROM warehouse_bin_allocations wba
      JOIN warehouse_bins wb ON wb.id = wba.bin_id
      WHERE wba.warehouse_item_id = v_item_id
        AND wba.company_id = p_company_id
        AND wb.location_id = p_location_id
      ORDER BY wba.allocated_quantity DESC
      LIMIT 1;

      IF v_alloc_id IS NOT NULL THEN
        item_id := v_item_id; item_code := v_item_code; action := 'ok';
        message := 'Already in sync at location (loc_stock=' || v_loc_stock || ')';
        RETURN NEXT; CONTINUE;
      END IF;

      IF v_override_bin_id IS NOT NULL THEN
        IF NOT EXISTS (
          SELECT 1 FROM warehouse_bins
          WHERE id = v_override_bin_id AND location_id = p_location_id
        ) THEN
          item_id := v_item_id; item_code := v_item_code; action := 'blocked';
          message := 'Override bin is not at the selected location';
          RETURN NEXT; CONTINUE;
        END IF;

        INSERT INTO warehouse_bin_allocations (
          warehouse_item_id, bin_id, allocated_quantity, company_id
        ) VALUES (
          v_item_id, v_override_bin_id, 0, p_company_id
        )
        ON CONFLICT (warehouse_item_id, bin_id, company_id) DO NOTHING;

        item_id := v_item_id; item_code := v_item_code; action := 'created';
        message := 'Created empty allocation at selected location bin';
        RETURN NEXT; CONTINUE;
      END IF;

      item_id := v_item_id; item_code := v_item_code; action := 'blocked';
      message := 'No allocation at selected location and no bin override provided';
      RETURN NEXT; CONTINUE;
    END IF;

    IF v_override_location_id IS NOT NULL AND (v_location_id IS NULL OR v_location_id != v_override_location_id) THEN
      UPDATE warehouse_items SET location_id = v_override_location_id WHERE id = v_item_id;
      v_location_id := v_override_location_id;
    END IF;

    SELECT COALESCE(SUM(wba.allocated_quantity), 0)
      INTO v_alloc_total
    FROM warehouse_bin_allocations wba
    WHERE wba.warehouse_item_id = v_item_id
      AND wba.company_id = p_company_id;

    SELECT wba.id INTO v_alloc_id
    FROM warehouse_bin_allocations wba
    WHERE wba.warehouse_item_id = v_item_id
      AND wba.company_id = p_company_id
    ORDER BY wba.allocated_quantity DESC
    LIMIT 1;

    v_diff := v_current_stock - v_alloc_total;

    IF v_diff = 0 THEN
      item_id := v_item_id; item_code := v_item_code; action := 'ok';
      message := 'Already in sync (stock=' || v_current_stock || ')';
      RETURN NEXT; CONTINUE;
    END IF;

    IF v_alloc_id IS NOT NULL THEN
      UPDATE warehouse_bin_allocations
      SET allocated_quantity = GREATEST(0, allocated_quantity + v_diff)
      WHERE id = v_alloc_id;

      item_id := v_item_id; item_code := v_item_code; action := 'adjusted';
      message := 'Adjusted allocation by ' || v_diff || ' (stock=' || v_current_stock || ', was_alloc=' || v_alloc_total || ')';
      RETURN NEXT; CONTINUE;
    END IF;

    v_bin_id := v_override_bin_id;

    IF v_bin_id IS NULL AND v_location_id IS NOT NULL THEN
      SELECT wb.id INTO v_bin_id
      FROM warehouse_bins wb
      WHERE wb.location_id = v_location_id
        AND wb.status = 'active'
      ORDER BY wb.bin_code ASC
      LIMIT 1;
    END IF;

    IF v_bin_id IS NULL THEN
      item_id := v_item_id; item_code := v_item_code; action := 'blocked';
      message := 'No location/bin available (stock=' || v_current_stock || ')';
      RETURN NEXT; CONTINUE;
    END IF;

    INSERT INTO warehouse_bin_allocations (
      warehouse_item_id, bin_id, allocated_quantity, company_id
    ) VALUES (
      v_item_id, v_bin_id, GREATEST(0, v_current_stock), p_company_id
    );

    item_id := v_item_id; item_code := v_item_code; action := 'created';
    message := 'Created allocation with qty=' || GREATEST(0, v_current_stock);
    RETURN NEXT;
  END LOOP;
END;
$function$;
