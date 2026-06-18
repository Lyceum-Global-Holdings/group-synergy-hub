CREATE OR REPLACE FUNCTION public.list_allocated_bins_in_subtree(p_company_id uuid, p_location_id uuid DEFAULT NULL::uuid, p_item_id uuid DEFAULT NULL::uuid)
 RETURNS TABLE(id uuid, bin_code text, name text, location_id uuid, location_path text, allocated_qty numeric)
 LANGUAGE sql
 STABLE
 SET search_path TO 'public'
AS $function$
  WITH RECURSIVE subtree AS (
    -- Roots: do NOT filter by company_id. Locations/bins are shared
    -- physical infrastructure; multi-owner shared bins can hold stock from
    -- companies that don't own the warehouse node itself.
    SELECT wl.id, wl.name, wl.parent_id, wl.name::text AS path
    FROM public.warehouse_locations wl
    WHERE (p_location_id IS NULL OR wl.id = p_location_id)
    UNION ALL
    SELECT child.id, child.name, child.parent_id, (s.path || ' › ' || child.name)::text
    FROM public.warehouse_locations child
    JOIN subtree s ON child.parent_id = s.id
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