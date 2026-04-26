-- Add p_notes_contains filter (case-insensitive ILIKE with wildcard escaping)
-- to three warehouse report RPCs. CREATE OR REPLACE preserves grants.

-- 1) Stock Movement Ledger
CREATE OR REPLACE FUNCTION public.report_stock_movement_ledger(
  p_company_id uuid,
  p_date_from timestamp with time zone DEFAULT NULL::timestamp with time zone,
  p_date_to timestamp with time zone DEFAULT NULL::timestamp with time zone,
  p_location_id uuid DEFAULT NULL::uuid,
  p_notes_contains text DEFAULT NULL::text
)
RETURNS TABLE(
  txn_date timestamp with time zone, item_code text, item_name text,
  transaction_type text, reference_type text, quantity_change numeric,
  quantity_before numeric, quantity_after numeric, unit_cost numeric,
  total_value numeric, location_name text, user_email text, notes text
)
LANGUAGE sql
STABLE
SET search_path TO 'public'
AS $function$
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
      p_notes_contains IS NULL
      OR btrim(p_notes_contains) = ''
      OR st.notes ILIKE '%' ||
         replace(replace(replace(btrim(p_notes_contains), '\', '\\'), '%', '\%'), '_', '\_')
         || '%' ESCAPE '\'
    )
  ORDER BY st.created_at DESC
  LIMIT 50000;
$function$;

-- 2) Cycle Count Variance — filter applied to variance_reason
CREATE OR REPLACE FUNCTION public.report_cycle_count_variance(
  p_company_id uuid,
  p_date_from date DEFAULT NULL::date,
  p_date_to date DEFAULT NULL::date,
  p_location_id uuid DEFAULT NULL::uuid,
  p_notes_contains text DEFAULT NULL::text
)
RETURNS TABLE(
  count_number text, count_date date, status text, location_name text,
  item_code text, item_name text, system_quantity numeric,
  physical_quantity numeric, variance_quantity numeric,
  variance_value numeric, variance_percentage numeric, variance_reason text
)
LANGUAGE sql
STABLE
SET search_path TO 'public'
AS $function$
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
      p_notes_contains IS NULL
      OR btrim(p_notes_contains) = ''
      OR cci.variance_reason ILIKE '%' ||
         replace(replace(replace(btrim(p_notes_contains), '\', '\\'), '%', '\%'), '_', '\_')
         || '%' ESCAPE '\'
    )
  ORDER BY cc.count_date DESC, cc.count_number, wi.item_code
  LIMIT 50000;
$function$;

-- 3) Batch Traceability — filter applied to event notes (post-union)
CREATE OR REPLACE FUNCTION public.report_batch_traceability(
  p_company_id uuid,
  p_batch_number text DEFAULT NULL::text,
  p_item_code text DEFAULT NULL::text,
  p_direction text DEFAULT 'both'::text,
  p_notes_contains text DEFAULT NULL::text
)
RETURNS TABLE(
  trace_direction text, event_date timestamp with time zone, event_type text,
  reference_number text, batch_number text, item_code text, item_name text,
  quantity numeric, unit_cost numeric, counterparty text, notes text
)
LANGUAGE sql
STABLE
SET search_path TO 'public'
AS $function$
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
  FROM combined
  WHERE (
    p_notes_contains IS NULL
    OR btrim(p_notes_contains) = ''
    OR notes ILIKE '%' ||
       replace(replace(replace(btrim(p_notes_contains), '\', '\\'), '%', '\%'), '_', '\_')
       || '%' ESCAPE '\'
  )
  ORDER BY event_date DESC
  LIMIT 50000;
$function$;