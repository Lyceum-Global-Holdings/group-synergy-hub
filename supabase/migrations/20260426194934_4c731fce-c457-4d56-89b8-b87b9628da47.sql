-- Replace p_notes_contains with composite operator filter (p_notes_op + p_notes_terms)
-- on the three warehouse report RPCs. Whitelist of operators enforced inside each function.

-- 1) Stock Movement Ledger
DROP FUNCTION IF EXISTS public.report_stock_movement_ledger(uuid, timestamptz, timestamptz, uuid, text);

CREATE OR REPLACE FUNCTION public.report_stock_movement_ledger(
  p_company_id uuid,
  p_date_from timestamp with time zone DEFAULT NULL::timestamp with time zone,
  p_date_to timestamp with time zone DEFAULT NULL::timestamp with time zone,
  p_location_id uuid DEFAULT NULL::uuid,
  p_notes_op text DEFAULT 'contains'::text,
  p_notes_terms text[] DEFAULT NULL::text[]
)
RETURNS TABLE(
  txn_date timestamp with time zone, item_code text, item_name text,
  transaction_type text, reference_type text, quantity_change numeric,
  quantity_before numeric, quantity_after numeric, unit_cost numeric,
  total_value numeric, location_name text, user_email text, notes text
)
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

  -- Escape LIKE wildcards in each term (keep \ as escape char) and drop empties
  SELECT ARRAY(
    SELECT replace(replace(replace(btrim(t), '\', '\\'), '%', '\%'), '_', '\_')
    FROM unnest(COALESCE(p_notes_terms, ARRAY[]::text[])) AS t
    WHERE btrim(t) <> ''
  ) INTO v_terms;

  -- Cap at 5 terms to bound query cost
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
  FROM stock_transactions st
  JOIN warehouse_items wi ON wi.id = st.item_id
  LEFT JOIN warehouse_locations wl ON wl.id = wi.location_id
  LEFT JOIN profiles p ON p.id = st.created_by
  WHERE st.company_id = p_company_id
    AND (p_date_from IS NULL OR st.created_at >= p_date_from)
    AND (p_date_to IS NULL OR st.created_at <= p_date_to)
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

-- 2) Cycle Count Variance — filter applied to variance_reason
DROP FUNCTION IF EXISTS public.report_cycle_count_variance(uuid, date, date, uuid, text);

CREATE OR REPLACE FUNCTION public.report_cycle_count_variance(
  p_company_id uuid,
  p_date_from date DEFAULT NULL::date,
  p_date_to date DEFAULT NULL::date,
  p_location_id uuid DEFAULT NULL::uuid,
  p_notes_op text DEFAULT 'contains'::text,
  p_notes_terms text[] DEFAULT NULL::text[]
)
RETURNS TABLE(
  count_number text, count_date date, status text, location_name text,
  item_code text, item_name text, system_quantity numeric,
  physical_quantity numeric, variance_quantity numeric,
  variance_value numeric, variance_percentage numeric, variance_reason text
)
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
  JOIN warehouse_items wi ON wi.id = cci.warehouse_item_id
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

-- 3) Batch Traceability — filter applied to event notes (post-union)
DROP FUNCTION IF EXISTS public.report_batch_traceability(uuid, text, text, text, text);

CREATE OR REPLACE FUNCTION public.report_batch_traceability(
  p_company_id uuid,
  p_batch_number text DEFAULT NULL::text,
  p_item_code text DEFAULT NULL::text,
  p_direction text DEFAULT 'both'::text,
  p_notes_op text DEFAULT 'contains'::text,
  p_notes_terms text[] DEFAULT NULL::text[]
)
RETURNS TABLE(
  trace_direction text, event_date timestamp with time zone, event_type text,
  reference_number text, batch_number text, item_code text, item_name text,
  quantity numeric, unit_cost numeric, counterparty text, notes text
)
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