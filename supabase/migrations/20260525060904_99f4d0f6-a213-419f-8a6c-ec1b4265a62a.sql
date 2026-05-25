CREATE OR REPLACE FUNCTION public.report_item_stock_availability(
  p_catalog_item_id uuid,
  p_location_id uuid DEFAULT NULL,
  p_bin_id uuid DEFAULT NULL,
  p_group_by text DEFAULT 'bin',
  p_include_zero boolean DEFAULT false,
  p_include_batches boolean DEFAULT false
)
RETURNS TABLE(
  company_id uuid,
  company_name text,
  location_id uuid,
  location_path text,
  bin_id uuid,
  bin_code text,
  bin_name text,
  batch_number text,
  unit_name text,
  on_hand_qty numeric,
  reserved_qty numeric,
  available_qty numeric,
  unit_cost numeric,
  stock_value numeric,
  status text
)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path TO 'public'
AS $function$
  WITH accessible AS (
    SELECT
      wi.id            AS warehouse_item_id,
      wi.company_id,
      c.name           AS company_name,
      wi.unit_cost,
      wi.status,
      iu.name          AS unit_name
    FROM public.warehouse_items_full wi
    JOIN public.companies c ON c.id = wi.company_id
    LEFT JOIN public.item_units iu ON iu.id = wi.unit_id
    WHERE wi.catalog_item_id = p_catalog_item_id
      AND public.can_access_company(wi.company_id)
  ),
  loc_path AS (
    SELECT
      l.id,
      CASE
        WHEN l.parent_id IS NULL THEN l.name
        ELSE COALESCE(p.name, '') || ' › ' || l.name
      END AS path
    FROM public.warehouse_locations l
    LEFT JOIN public.warehouse_locations p ON p.id = l.parent_id
  ),
  bin_rows AS (
    SELECT
      a.company_id,
      a.company_name,
      b.location_id,
      lp.path                                                 AS location_path,
      b.id                                                    AS bin_id,
      b.bin_code,
      b.name                                                  AS bin_name,
      NULL::text                                              AS batch_number,
      a.unit_name,
      COALESCE(wba.allocated_quantity, 0)::numeric            AS on_hand_qty,
      COALESCE(wba.reserved_quantity, 0)::numeric             AS reserved_qty,
      COALESCE(
        wba.available_quantity,
        COALESCE(wba.allocated_quantity, 0) - COALESCE(wba.reserved_quantity, 0)
      )::numeric                                              AS available_qty,
      COALESCE(a.unit_cost, 0)::numeric                       AS unit_cost,
      (COALESCE(wba.allocated_quantity, 0) * COALESCE(a.unit_cost, 0))::numeric AS stock_value,
      a.status
    FROM public.warehouse_bin_allocations wba
    JOIN accessible a       ON a.warehouse_item_id = wba.warehouse_item_id
    JOIN public.warehouse_bins b ON b.id = wba.bin_id
    LEFT JOIN loc_path lp   ON lp.id = b.location_id
    WHERE (p_location_id IS NULL OR b.location_id = p_location_id)
      AND (p_bin_id      IS NULL OR b.id          = p_bin_id)
      AND NOT p_include_batches
  ),
  batch_rows AS (
    SELECT
      a.company_id,
      a.company_name,
      NULL::uuid                                              AS location_id,
      NULL::text                                              AS location_path,
      NULL::uuid                                              AS bin_id,
      NULL::text                                              AS bin_code,
      NULL::text                                              AS bin_name,
      ib.batch_number,
      a.unit_name,
      COALESCE(ib.quantity_remaining, 0)::numeric             AS on_hand_qty,
      0::numeric                                              AS reserved_qty,
      COALESCE(ib.quantity_remaining, 0)::numeric             AS available_qty,
      COALESCE(ib.unit_cost, a.unit_cost, 0)::numeric         AS unit_cost,
      (COALESCE(ib.quantity_remaining, 0) * COALESCE(ib.unit_cost, a.unit_cost, 0))::numeric AS stock_value,
      a.status
    FROM public.item_batches ib
    JOIN accessible a ON a.warehouse_item_id = ib.warehouse_item_id
    WHERE p_include_batches
  ),
  combined AS (
    SELECT * FROM bin_rows
    UNION ALL
    SELECT * FROM batch_rows
  ),
  agg AS (
    SELECT
      company_id,
      company_name,
      CASE WHEN p_group_by IN ('bin', 'location') OR p_include_batches THEN location_id   END AS location_id,
      CASE WHEN p_group_by IN ('bin', 'location') OR p_include_batches THEN location_path END AS location_path,
      CASE WHEN p_group_by = 'bin' OR p_include_batches THEN bin_id   END AS bin_id,
      CASE WHEN p_group_by = 'bin' OR p_include_batches THEN bin_code END AS bin_code,
      CASE WHEN p_group_by = 'bin' OR p_include_batches THEN bin_name END AS bin_name,
      batch_number,
      MAX(unit_name)                  AS unit_name,
      SUM(on_hand_qty)::numeric       AS on_hand_qty,
      SUM(reserved_qty)::numeric      AS reserved_qty,
      SUM(available_qty)::numeric     AS available_qty,
      MAX(unit_cost)                  AS unit_cost,
      SUM(stock_value)::numeric       AS stock_value,
      MAX(status)                     AS status
    FROM combined
    GROUP BY 1, 2, 3, 4, 5, 6, 7, 8
  )
  SELECT
    company_id, company_name,
    location_id, location_path,
    bin_id, bin_code, bin_name,
    batch_number,
    unit_name,
    on_hand_qty, reserved_qty, available_qty,
    unit_cost, stock_value,
    status
  FROM agg
  WHERE p_include_zero OR on_hand_qty > 0
  ORDER BY
    company_name ASC,
    location_path ASC NULLS LAST,
    bin_code ASC NULLS LAST,
    batch_number ASC NULLS LAST;
$function$;

GRANT EXECUTE ON FUNCTION public.report_item_stock_availability(uuid, uuid, uuid, text, boolean, boolean) TO authenticated;