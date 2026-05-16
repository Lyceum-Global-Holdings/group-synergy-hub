-- Stage 6e: server-side search/pagination for partial piece parent picker.
DROP FUNCTION IF EXISTS public.list_partial_piece_items(uuid, uuid);
DROP FUNCTION IF EXISTS public.list_partial_piece_items(uuid, uuid, text, integer, integer);

CREATE FUNCTION public.list_partial_piece_items(
  p_company_id uuid,
  p_location_id uuid DEFAULT NULL,
  p_search text DEFAULT NULL,
  p_limit integer DEFAULT 100,
  p_offset integer DEFAULT 0
)
RETURNS TABLE(
  catalog_item_id uuid,
  parent_item_id uuid,
  item_code text,
  item_name text,
  base_uom text,
  secondary_uom text,
  unit_cost numeric,
  track_secondary_quantity boolean,
  has_inventory_row boolean,
  piece_count bigint,
  total_count bigint
)
LANGUAGE sql
STABLE
SET search_path TO 'public'
AS $function$
  WITH base AS (
    SELECT
      c.id AS catalog_item_id,
      i.id AS parent_item_id,
      btrim(c.item_code) AS item_code,
      c.name AS item_name,
      COALESCE(i.base_uom, u.abbreviation) AS base_uom,
      i.secondary_uom,
      COALESCE(i.unit_cost, c.unit_cost) AS unit_cost,
      COALESCE(i.track_secondary_quantity, false) AS track_secondary_quantity,
      (i.id IS NOT NULL) AS has_inventory_row
    FROM public.warehouse_item_catalog c
    LEFT JOIN public.warehouse_items i
      ON i.catalog_item_id = c.id
     AND i.company_id = p_company_id
    LEFT JOIN public.item_units u
      ON u.id = c.unit_id
    WHERE COALESCE(c.status::text, 'active') = 'active'
      AND (i.id IS NULL OR COALESCE(i.status::text, 'active') = 'active')
      AND (
        p_search IS NULL
        OR btrim(p_search) = ''
        OR c.name ILIKE '%' || btrim(p_search) || '%'
        OR btrim(c.item_code) ILIKE '%' || btrim(p_search) || '%'
      )
  ), counted AS (
    SELECT b.*, COUNT(*) OVER () AS total_count FROM base b
  )
  SELECT
    catalog_item_id,
    parent_item_id,
    item_code,
    item_name,
    base_uom,
    secondary_uom,
    unit_cost,
    track_secondary_quantity,
    has_inventory_row,
    COALESCE((
      SELECT COUNT(*)
        FROM public.warehouse_partial_pieces p
       WHERE p.company_id = p_company_id
         AND p.parent_item_id = counted.parent_item_id
         AND (p_location_id IS NULL OR p.location_id = p_location_id)
    ), 0) AS piece_count,
    total_count
  FROM counted
  ORDER BY item_code NULLS LAST, item_name
  LIMIT GREATEST(COALESCE(p_limit, 100), 1)
  OFFSET GREATEST(COALESCE(p_offset, 0), 0);
$function$;

GRANT EXECUTE ON FUNCTION public.list_partial_piece_items(uuid, uuid, text, integer, integer) TO authenticated;