DROP FUNCTION IF EXISTS public.list_partial_piece_items(uuid, uuid);

CREATE FUNCTION public.list_partial_piece_items(
  p_company_id uuid,
  p_location_id uuid DEFAULT NULL::uuid
)
RETURNS TABLE(
  parent_item_id uuid,
  item_code text,
  item_name text,
  base_uom text,
  secondary_uom text,
  unit_cost numeric,
  track_secondary_quantity boolean,
  piece_count bigint
)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public AS $$
  SELECT
    i.id,
    i.item_code,
    i.name,
    i.base_uom,
    i.secondary_uom,
    i.unit_cost,
    COALESCE(i.track_secondary_quantity, false),
    COUNT(p.id) FILTER (
      WHERE p.company_id = p_company_id
        AND (p_location_id IS NULL OR p.location_id = p_location_id)
    ) AS piece_count
  FROM public.warehouse_items i
  LEFT JOIN public.warehouse_partial_pieces p
    ON p.parent_item_id = i.id
  WHERE i.company_id = p_company_id
    AND COALESCE(i.status::text, 'active') = 'active'
  GROUP BY i.id, i.item_code, i.name, i.base_uom, i.secondary_uom, i.unit_cost, i.track_secondary_quantity
  ORDER BY i.item_code;
$$;