CREATE OR REPLACE FUNCTION public.report_stock_on_hand(
  p_company_id uuid,
  p_location_id uuid DEFAULT NULL,
  p_category_id uuid DEFAULT NULL,
  p_include_zero boolean DEFAULT false,
  p_bin_id uuid DEFAULT NULL,
  p_bin_wise boolean DEFAULT false,
  p_include_bin_ids uuid[] DEFAULT NULL,
  p_exclude_bin_ids uuid[] DEFAULT NULL
)
RETURNS TABLE(
  item_id uuid,
  item_code text,
  item_name text,
  category_id uuid,
  category_name text,
  location_id uuid,
  location_name text,
  unit_name text,
  bin_id uuid,
  bin_code text,
  bin_name text,
  current_stock numeric,
  reserved_quantity numeric,
  available_quantity numeric,
  unit_cost numeric,
  stock_value numeric,
  min_stock_level numeric,
  reorder_level numeric,
  status text
)
LANGUAGE sql
STABLE
SET search_path TO 'public'
AS $function$
  WITH RECURSIVE subtree AS (
    SELECT wl.id
    FROM public.warehouse_locations wl
    WHERE p_location_id IS NULL OR wl.id = p_location_id
    UNION ALL
    SELECT child.id
    FROM public.warehouse_locations child
    JOIN subtree s ON child.parent_id = s.id
  ),
  include_bins AS (
    SELECT CASE
      WHEN p_include_bin_ids IS NOT NULL AND array_length(p_include_bin_ids, 1) > 0
        THEN p_include_bin_ids
      WHEN p_bin_id IS NOT NULL THEN ARRAY[p_bin_id]
      ELSE NULL
    END AS ids
  ),
  filtered_allocations AS (
    SELECT
      wba.warehouse_item_id,
      wba.bin_id,
      COALESCE(wba.location_id, wb.location_id) AS allocation_location_id,
      wba.allocated_quantity,
      wba.reserved_quantity
    FROM public.warehouse_bin_allocations wba
    JOIN public.warehouse_bins wb ON wb.id = wba.bin_id
    CROSS JOIN include_bins ib
    WHERE wba.company_id = p_company_id
      AND (p_location_id IS NULL OR COALESCE(wba.location_id, wb.location_id) IN (SELECT id FROM subtree))
      AND (ib.ids IS NULL OR wba.bin_id = ANY(ib.ids))
      AND (p_exclude_bin_ids IS NULL OR array_length(p_exclude_bin_ids, 1) IS NULL OR NOT (wba.bin_id = ANY(p_exclude_bin_ids)))
  )
  SELECT
    wi.id,
    wi.item_code,
    wi.name,
    wi.category_id,
    ic.name,
    fa.allocation_location_id,
    wl_bin.name,
    iu.name,
    wb.id,
    wb.bin_code,
    wb.name,
    COALESCE(fa.allocated_quantity, 0)::numeric,
    COALESCE(fa.reserved_quantity, 0)::numeric,
    GREATEST(COALESCE(fa.allocated_quantity, 0) - COALESCE(fa.reserved_quantity, 0), 0)::numeric,
    COALESCE(wi.unit_cost, 0)::numeric,
    (COALESCE(fa.allocated_quantity, 0) * COALESCE(wi.unit_cost, 0))::numeric,
    COALESCE(wi.min_stock_level, 0)::numeric,
    COALESCE(wi.reorder_level, 0)::numeric,
    wi.status
  FROM public.warehouse_items_full wi
  JOIN filtered_allocations fa ON fa.warehouse_item_id = wi.id
  JOIN public.warehouse_bins wb ON wb.id = fa.bin_id
  LEFT JOIN public.warehouse_locations wl_bin ON wl_bin.id = fa.allocation_location_id
  LEFT JOIN public.item_categories ic ON ic.id = wi.category_id
  LEFT JOIN public.item_units iu ON iu.id = wi.unit_id
  WHERE p_bin_wise = true
    AND wi.company_id = p_company_id
    AND (p_category_id IS NULL OR wi.category_id = p_category_id)
    AND (p_include_zero OR COALESCE(fa.allocated_quantity, 0) > 0)

  UNION ALL

  SELECT
    wi.id,
    wi.item_code,
    wi.name,
    wi.category_id,
    ic.name,
    COALESCE(fa.allocation_location_id, wi.location_id),
    wl.name,
    iu.name,
    NULL::uuid,
    NULL::text,
    NULL::text,
    COALESCE(SUM(fa.allocated_quantity), 0)::numeric,
    COALESCE(SUM(fa.reserved_quantity), 0)::numeric,
    GREATEST(COALESCE(SUM(fa.allocated_quantity), 0) - COALESCE(SUM(fa.reserved_quantity), 0), 0)::numeric,
    COALESCE(wi.unit_cost, 0)::numeric,
    (COALESCE(SUM(fa.allocated_quantity), 0) * COALESCE(wi.unit_cost, 0))::numeric,
    COALESCE(wi.min_stock_level, 0)::numeric,
    COALESCE(wi.reorder_level, 0)::numeric,
    wi.status
  FROM public.warehouse_items_full wi
  LEFT JOIN filtered_allocations fa ON fa.warehouse_item_id = wi.id
  LEFT JOIN public.warehouse_locations wl ON wl.id = COALESCE(fa.allocation_location_id, wi.location_id)
  LEFT JOIN public.item_categories ic ON ic.id = wi.category_id
  LEFT JOIN public.item_units iu ON iu.id = wi.unit_id
  WHERE p_bin_wise = false
    AND wi.company_id = p_company_id
    AND (p_category_id IS NULL OR wi.category_id = p_category_id)
    AND (
      p_location_id IS NULL
      OR fa.allocation_location_id IN (SELECT id FROM subtree)
      OR (p_include_zero AND wi.location_id IN (SELECT id FROM subtree))
    )
  GROUP BY wi.id, wi.item_code, wi.name, wi.category_id, ic.name,
           COALESCE(fa.allocation_location_id, wi.location_id), wl.name, iu.name,
           wi.unit_cost, wi.min_stock_level, wi.reorder_level, wi.status
  HAVING p_include_zero OR COALESCE(SUM(fa.allocated_quantity), 0) > 0
  ORDER BY 2, 11 NULLS LAST;
$function$;

GRANT EXECUTE ON FUNCTION public.report_stock_on_hand(uuid, uuid, uuid, boolean, uuid, boolean, uuid[], uuid[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.report_stock_on_hand(uuid, uuid, uuid, boolean, uuid, boolean, uuid[], uuid[]) TO service_role;