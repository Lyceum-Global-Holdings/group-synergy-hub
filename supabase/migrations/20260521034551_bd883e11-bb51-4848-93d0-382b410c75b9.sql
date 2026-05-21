-- =========================================================
-- WH-PP-OH-001  Partial Pieces on Hand
-- =========================================================
CREATE OR REPLACE FUNCTION public.report_partial_pieces_on_hand(
  p_company_id   uuid,
  p_location_id  uuid    DEFAULT NULL,
  p_bin_id       uuid    DEFAULT NULL,
  p_category_id  uuid    DEFAULT NULL,
  p_item_id      uuid    DEFAULT NULL,
  p_status       text    DEFAULT 'available',
  p_include_zero boolean DEFAULT false
)
RETURNS TABLE(
  piece_id uuid,
  piece_code text,
  item_id uuid,
  item_code text,
  item_name text,
  category_id uuid,
  category_name text,
  location_id uuid,
  location_name text,
  bin_id uuid,
  bin_code text,
  bin_name text,
  size_value numeric,
  size_uom text,
  piece_count integer,
  original_piece_count integer,
  total_size numeric,
  base_uom text,
  secondary_uom text,
  unit_cost numeric,
  stock_value numeric,
  batch_number text,
  source_ref text,
  label text,
  status text,
  age_days integer,
  created_at timestamptz
)
LANGUAGE sql
STABLE
SET search_path TO 'public'
AS $function$
  SELECT
    pp.id,
    pp.piece_code,
    pp.parent_item_id,
    wi.item_code,
    wi.name,
    wi.category_id,
    ic.name,
    pp.location_id,
    wl.name,
    pp.bin_id,
    wb.bin_code,
    wb.name,
    pp.size_value,
    pp.size_uom,
    pp.piece_count,
    pp.original_piece_count,
    (pp.size_value * pp.piece_count)::numeric,
    wi.base_uom,
    wi.secondary_uom,
    COALESCE(pp.unit_cost, wi.unit_cost, 0)::numeric,
    (pp.size_value * pp.piece_count * COALESCE(pp.unit_cost, wi.unit_cost, 0))::numeric,
    pp.batch_number,
    pp.source_ref,
    pp.label,
    pp.status::text,
    GREATEST(0, EXTRACT(DAY FROM (now() - pp.created_at))::int),
    pp.created_at
  FROM public.warehouse_partial_pieces pp
  LEFT JOIN public.warehouse_items_full wi ON wi.id = pp.parent_item_id
  LEFT JOIN public.item_categories ic      ON ic.id = wi.category_id
  LEFT JOIN public.warehouse_locations wl  ON wl.id = pp.location_id
  LEFT JOIN public.warehouse_bins wb       ON wb.id = pp.bin_id
  WHERE pp.company_id = p_company_id
    AND (p_location_id IS NULL OR pp.location_id = p_location_id)
    AND (p_bin_id      IS NULL OR pp.bin_id      = p_bin_id)
    AND (p_category_id IS NULL OR wi.category_id = p_category_id)
    AND (p_item_id     IS NULL OR pp.parent_item_id = p_item_id)
    AND (
      p_status IS NULL OR p_status = '' OR lower(p_status) = 'all'
      OR pp.status::text = lower(p_status)
    )
    AND (p_include_zero OR pp.piece_count > 0)
  ORDER BY wi.item_code NULLS LAST, pp.piece_code;
$function$;

-- =========================================================
-- WH-PP-MOV-001  Partial Pieces Movement Ledger
-- =========================================================
CREATE OR REPLACE FUNCTION public.report_partial_pieces_movement(
  p_company_id   uuid,
  p_date_from    timestamptz DEFAULT NULL,
  p_date_to      timestamptz DEFAULT NULL,
  p_location_id  uuid        DEFAULT NULL,
  p_bin_id       uuid        DEFAULT NULL,
  p_item_id      uuid        DEFAULT NULL,
  p_event_type   text        DEFAULT NULL
)
RETURNS TABLE(
  event_at timestamptz,
  event_type text,
  piece_id uuid,
  piece_code text,
  parent_piece_code text,
  item_id uuid,
  item_code text,
  item_name text,
  location_id uuid,
  location_name text,
  bin_id uuid,
  bin_code text,
  size_value numeric,
  size_uom text,
  event_pieces integer,
  event_qty numeric,
  unit_cost numeric,
  event_value numeric,
  reason text,
  user_email text,
  notes text
)
LANGUAGE sql
STABLE
SET search_path TO 'public'
AS $function$
  WITH base AS (
    SELECT
      pp.*,
      wi.item_code     AS wi_item_code,
      wi.name          AS wi_item_name,
      COALESCE(pp.unit_cost, wi.unit_cost, 0)::numeric AS eff_unit_cost,
      wl.name          AS loc_name,
      wb.bin_code      AS bin_code_v,
      pr.email         AS created_email,
      cr.email         AS consumed_email,
      parent.piece_code AS parent_code
    FROM public.warehouse_partial_pieces pp
    LEFT JOIN public.warehouse_items_full wi ON wi.id = pp.parent_item_id
    LEFT JOIN public.warehouse_locations wl  ON wl.id = pp.location_id
    LEFT JOIN public.warehouse_bins wb       ON wb.id = pp.bin_id
    LEFT JOIN public.profiles pr             ON pr.id = pp.created_by
    LEFT JOIN public.profiles cr             ON cr.id = pp.consumed_by
    LEFT JOIN public.warehouse_partial_pieces parent ON parent.id = pp.parent_piece_id
    WHERE pp.company_id = p_company_id
      AND (p_location_id IS NULL OR pp.location_id = p_location_id)
      AND (p_bin_id      IS NULL OR pp.bin_id      = p_bin_id)
      AND (p_item_id     IS NULL OR pp.parent_item_id = p_item_id)
  ),
  events AS (
    -- CREATE / SPLIT_IN: birth of the record
    SELECT
      b.created_at AS event_at,
      CASE WHEN b.parent_piece_id IS NULL THEN 'CREATE' ELSE 'SPLIT_IN' END AS event_type,
      b.id, b.piece_code, b.parent_code,
      b.parent_item_id, b.wi_item_code, b.wi_item_name,
      b.location_id, b.loc_name,
      b.bin_id, b.bin_code_v,
      b.size_value, b.size_uom,
      b.original_piece_count AS event_pieces,
      (b.size_value * b.original_piece_count)::numeric AS event_qty,
      b.eff_unit_cost AS unit_cost,
      (b.size_value * b.original_piece_count * b.eff_unit_cost)::numeric AS event_value,
      NULL::text AS reason,
      b.created_email AS user_email,
      COALESCE('source_ref:' || NULLIF(b.source_ref,''), '') ||
        CASE WHEN b.label IS NOT NULL AND b.label <> '' THEN ' / label:' || b.label ELSE '' END AS notes
    FROM base b

    UNION ALL

    -- CONSUME / SCRAP: lifecycle terminations
    SELECT
      b.consumed_at AS event_at,
      CASE WHEN b.status::text = 'scrapped' THEN 'SCRAP' ELSE 'CONSUME' END AS event_type,
      b.id, b.piece_code, b.parent_code,
      b.parent_item_id, b.wi_item_code, b.wi_item_name,
      b.location_id, b.loc_name,
      b.bin_id, b.bin_code_v,
      b.size_value, b.size_uom,
      (-b.original_piece_count) AS event_pieces,
      (-COALESCE(b.consumed_qty, b.size_value * b.original_piece_count))::numeric AS event_qty,
      b.eff_unit_cost AS unit_cost,
      (-COALESCE(b.consumed_qty, b.size_value * b.original_piece_count) * b.eff_unit_cost)::numeric AS event_value,
      b.consumed_reason AS reason,
      b.consumed_email AS user_email,
      COALESCE('reason:' || NULLIF(b.consumed_reason,''), '') AS notes
    FROM base b
    WHERE b.status::text IN ('consumed','scrapped') AND b.consumed_at IS NOT NULL
  )
  SELECT
    e.event_at, e.event_type,
    e.id, e.piece_code, e.parent_code,
    e.parent_item_id, e.wi_item_code, e.wi_item_name,
    e.location_id, e.loc_name,
    e.bin_id, e.bin_code_v,
    e.size_value, e.size_uom,
    e.event_pieces, e.event_qty,
    e.unit_cost, e.event_value,
    e.reason, e.user_email, e.notes
  FROM events e
  WHERE (p_date_from IS NULL OR e.event_at >= p_date_from)
    AND (p_date_to   IS NULL OR e.event_at <= p_date_to)
    AND (p_event_type IS NULL OR p_event_type = '' OR upper(p_event_type) = 'ALL'
         OR e.event_type = upper(p_event_type))
  ORDER BY e.event_at DESC, e.piece_code;
$function$;