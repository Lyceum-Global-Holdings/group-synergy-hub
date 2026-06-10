
-- 1) Allocated bins in subtree of a warehouse/sub-location
CREATE OR REPLACE FUNCTION public.list_allocated_bins_in_subtree(
  p_company_id uuid,
  p_location_id uuid DEFAULT NULL,
  p_item_id uuid DEFAULT NULL
)
RETURNS TABLE(
  id uuid,
  bin_code text,
  name text,
  location_id uuid,
  location_path text,
  allocated_qty numeric
)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path TO 'public'
AS $function$
  WITH RECURSIVE subtree AS (
    SELECT wl.id, wl.name, wl.parent_id, wl.name::text AS path
    FROM public.warehouse_locations wl
    WHERE wl.company_id = p_company_id
      AND (p_location_id IS NULL OR wl.id = p_location_id)
    UNION ALL
    SELECT child.id, child.name, child.parent_id, (s.path || ' › ' || child.name)::text
    FROM public.warehouse_locations child
    JOIN subtree s ON child.parent_id = s.id
    WHERE child.company_id = p_company_id
  )
  SELECT
    wb.id,
    wb.bin_code,
    wb.name,
    COALESCE(wba.location_id, wb.location_id) AS location_id,
    s.path AS location_path,
    SUM(COALESCE(wba.allocated_quantity, 0))::numeric AS allocated_qty
  FROM public.warehouse_bin_allocations wba
  JOIN public.warehouse_bins wb ON wb.id = wba.bin_id
  JOIN subtree s ON s.id = COALESCE(wba.location_id, wb.location_id)
  WHERE wba.company_id = p_company_id
    AND (p_item_id IS NULL OR wba.warehouse_item_id = p_item_id)
    AND COALESCE(wba.allocated_quantity, 0) > 0
  GROUP BY wb.id, wb.bin_code, wb.name, COALESCE(wba.location_id, wb.location_id), s.path
  ORDER BY wb.bin_code;
$function$;

GRANT EXECUTE ON FUNCTION public.list_allocated_bins_in_subtree(uuid, uuid, uuid) TO authenticated;

-- 2) Stock-on-hand report: subtree location + include/exclude bin arrays
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
    WHERE wl.company_id = p_company_id
      AND (p_location_id IS NULL OR wl.id = p_location_id)
    UNION ALL
    SELECT child.id
    FROM public.warehouse_locations child
    JOIN subtree s ON child.parent_id = s.id
    WHERE child.company_id = p_company_id
  ),
  -- Backward compatibility: fold legacy single p_bin_id into include set
  include_bins AS (
    SELECT CASE
      WHEN p_include_bin_ids IS NOT NULL AND array_length(p_include_bin_ids, 1) > 0
        THEN p_include_bin_ids
      WHEN p_bin_id IS NOT NULL THEN ARRAY[p_bin_id]
      ELSE NULL
    END AS ids
  )
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
  CROSS JOIN include_bins ib
  WHERE p_bin_wise = true
    AND wi.company_id = p_company_id
    AND (p_location_id IS NULL
         OR COALESCE(wba.location_id, wb.location_id) IN (SELECT id FROM subtree))
    AND (p_category_id IS NULL OR wi.category_id = p_category_id)
    AND (ib.ids IS NULL OR wb.id = ANY(ib.ids))
    AND (p_exclude_bin_ids IS NULL OR array_length(p_exclude_bin_ids,1) IS NULL OR NOT (wb.id = ANY(p_exclude_bin_ids)))
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
   AND (
     (p_include_bin_ids IS NOT NULL AND array_length(p_include_bin_ids,1) > 0 AND wba.bin_id = ANY(p_include_bin_ids))
     OR (p_include_bin_ids IS NULL AND p_bin_id IS NOT NULL AND wba.bin_id = p_bin_id)
     OR (p_include_bin_ids IS NULL AND p_bin_id IS NULL)
   )
   AND (p_exclude_bin_ids IS NULL OR array_length(p_exclude_bin_ids,1) IS NULL OR NOT (wba.bin_id = ANY(p_exclude_bin_ids)))
   AND (p_location_id IS NULL
        OR COALESCE(wba.location_id, (SELECT location_id FROM public.warehouse_bins WHERE id = wba.bin_id))
           IN (SELECT id FROM subtree))
  LEFT JOIN public.warehouse_locations wl ON wl.id = wi.location_id
  LEFT JOIN public.item_categories ic ON ic.id = wi.category_id
  LEFT JOIN public.item_units iu ON iu.id = wi.unit_id
  WHERE p_bin_wise = false
    AND wi.company_id = p_company_id
    AND (p_location_id IS NULL OR wi.location_id IN (SELECT id FROM subtree))
    AND (p_category_id IS NULL OR wi.category_id = p_category_id)
  GROUP BY wi.id, wi.item_code, wi.name, wi.category_id, ic.name, wl.id, wl.name, iu.name,
           wi.unit_cost, wi.min_stock_level, wi.reorder_level, wi.status
  HAVING p_include_zero OR COALESCE(SUM(wba.allocated_quantity), 0) > 0
  ORDER BY 2, 11 NULLS LAST;
$function$;

GRANT EXECUTE ON FUNCTION public.report_stock_on_hand(uuid, uuid, uuid, boolean, uuid, boolean, uuid[], uuid[]) TO authenticated;
