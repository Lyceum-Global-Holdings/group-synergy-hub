CREATE OR REPLACE FUNCTION public.report_stock_on_hand(
  p_company_id uuid,
  p_location_id uuid DEFAULT NULL,
  p_category_id uuid DEFAULT NULL,
  p_include_zero boolean DEFAULT false,
  p_bin_id uuid DEFAULT NULL,
  p_bin_wise boolean DEFAULT false
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
  -- Bin-wise: one row per (item, bin) sourced from warehouse_bin_allocations.
  SELECT
    wi.id,
    wi.item_code,
    wi.name,
    wi.category_id,
    ic.name,
    wl_bin.id,
    wl_bin.name,
    iu.name,
    wb.id,
    wb.bin_code,
    wb.name,
    COALESCE(wba.allocated_quantity, 0)::numeric,
    COALESCE(wba.reserved_quantity, 0)::numeric,
    GREATEST(COALESCE(wba.allocated_quantity,0) - COALESCE(wba.reserved_quantity,0), 0)::numeric,
    COALESCE(wi.unit_cost, 0)::numeric,
    (COALESCE(wba.allocated_quantity, 0) * COALESCE(wi.unit_cost, 0))::numeric,
    COALESCE(wi.min_stock_level, 0)::numeric,
    COALESCE(wi.reorder_level, 0)::numeric,
    wi.status
  FROM public.warehouse_items_full wi
  JOIN public.warehouse_bin_allocations wba
    ON wba.warehouse_item_id = wi.id AND wba.company_id = p_company_id
  JOIN public.warehouse_bins wb ON wb.id = wba.bin_id
  LEFT JOIN public.warehouse_locations wl_bin ON wl_bin.id = COALESCE(wba.location_id, wb.location_id)
  LEFT JOIN public.item_categories ic ON ic.id = wi.category_id
  LEFT JOIN public.item_units iu ON iu.id = wi.unit_id
  WHERE p_bin_wise = true
    AND wi.company_id = p_company_id
    AND (p_location_id IS NULL
         OR wi.location_id = p_location_id
         OR COALESCE(wba.location_id, wb.location_id) = p_location_id)
    AND (p_category_id IS NULL OR wi.category_id = p_category_id)
    AND (p_bin_id IS NULL OR wb.id = p_bin_id)
    AND (p_include_zero OR COALESCE(wba.allocated_quantity, 0) > 0)

  UNION ALL

  -- Aggregated (legacy shape): one row per (item, location) summing bin allocations.
  SELECT
    wi.id,
    wi.item_code,
    wi.name,
    wi.category_id,
    ic.name,
    wl.id,
    wl.name,
    iu.name,
    NULL::uuid,
    NULL::text,
    NULL::text,
    COALESCE(SUM(wba.allocated_quantity), 0)::numeric,
    COALESCE(SUM(wba.reserved_quantity), 0)::numeric,
    GREATEST(COALESCE(SUM(wba.allocated_quantity),0) - COALESCE(SUM(wba.reserved_quantity),0), 0)::numeric,
    COALESCE(wi.unit_cost, 0)::numeric,
    (COALESCE(SUM(wba.allocated_quantity), 0) * COALESCE(wi.unit_cost, 0))::numeric,
    COALESCE(wi.min_stock_level, 0)::numeric,
    COALESCE(wi.reorder_level, 0)::numeric,
    wi.status
  FROM public.warehouse_items_full wi
  LEFT JOIN public.warehouse_bin_allocations wba
    ON wba.warehouse_item_id = wi.id
   AND wba.company_id = p_company_id
   AND (p_bin_id IS NULL OR wba.bin_id = p_bin_id)
   AND (p_location_id IS NULL OR wba.location_id = p_location_id)
  LEFT JOIN public.warehouse_locations wl ON wl.id = wi.location_id
  LEFT JOIN public.item_categories ic ON ic.id = wi.category_id
  LEFT JOIN public.item_units iu ON iu.id = wi.unit_id
  WHERE p_bin_wise = false
    AND wi.company_id = p_company_id
    AND (p_location_id IS NULL OR wi.location_id = p_location_id)
    AND (p_category_id IS NULL OR wi.category_id = p_category_id)
  GROUP BY wi.id, wi.item_code, wi.name, wi.category_id, ic.name, wl.id, wl.name, iu.name,
           wi.unit_cost, wi.min_stock_level, wi.reorder_level, wi.status
  HAVING p_include_zero OR COALESCE(SUM(wba.allocated_quantity), 0) > 0
  ORDER BY 2, 11 NULLS LAST;
$function$;