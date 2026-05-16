-- Stage 6d: Partial Pieces picker sources from full Item Master (catalog),
-- not just provisioned company warehouse_items rows.

DROP FUNCTION IF EXISTS public.list_partial_piece_items(uuid, uuid);

CREATE FUNCTION public.list_partial_piece_items(
  p_company_id uuid,
  p_location_id uuid DEFAULT NULL
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
  piece_count bigint
)
LANGUAGE sql
STABLE
SET search_path TO 'public'
AS $function$
  SELECT
    c.id AS catalog_item_id,
    i.id AS parent_item_id,
    c.item_code,
    c.name AS item_name,
    COALESCE(i.base_uom, u.abbreviation) AS base_uom,
    i.secondary_uom,
    COALESCE(i.unit_cost, c.unit_cost) AS unit_cost,
    COALESCE(i.track_secondary_quantity, false) AS track_secondary_quantity,
    (i.id IS NOT NULL) AS has_inventory_row,
    COALESCE((
      SELECT COUNT(*)
        FROM public.warehouse_partial_pieces p
       WHERE p.company_id = p_company_id
         AND p.parent_item_id = i.id
         AND (p_location_id IS NULL OR p.location_id = p_location_id)
    ), 0) AS piece_count
  FROM public.warehouse_item_catalog c
  LEFT JOIN public.warehouse_items i
    ON i.catalog_item_id = c.id
   AND i.company_id = p_company_id
  LEFT JOIN public.item_units u
    ON u.id = c.unit_id
  WHERE COALESCE(c.status::text, 'active') = 'active'
    AND (i.id IS NULL OR COALESCE(i.status::text, 'active') = 'active')
  ORDER BY c.item_code;
$function$;

GRANT EXECUTE ON FUNCTION public.list_partial_piece_items(uuid, uuid) TO authenticated;

-- On-demand company inventory provisioning for catalog items that have no
-- warehouse_items row yet. Returns the warehouse_items.id usable as
-- partial_piece.parent_item_id.
CREATE OR REPLACE FUNCTION public.ensure_partial_piece_parent_item(
  p_company_id uuid,
  p_catalog_item_id uuid
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_item_id uuid;
  v_catalog record;
BEGIN
  IF p_company_id IS NULL OR p_catalog_item_id IS NULL THEN
    RAISE EXCEPTION 'company_id and catalog_item_id are required';
  END IF;

  -- Caller must have access to this company
  IF NOT public.can_access_company(p_company_id) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  SELECT id INTO v_item_id
    FROM public.warehouse_items
   WHERE company_id = p_company_id
     AND catalog_item_id = p_catalog_item_id;

  IF v_item_id IS NOT NULL THEN
    RETURN v_item_id;
  END IF;

  SELECT c.*, u.abbreviation AS unit_abbr
    INTO v_catalog
    FROM public.warehouse_item_catalog c
    LEFT JOIN public.item_units u ON u.id = c.unit_id
   WHERE c.id = p_catalog_item_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'catalog item not found';
  END IF;

  v_item_id := public.upsert_warehouse_inventory(
    p_company_id        := p_company_id,
    p_catalog_item_id   := p_catalog_item_id,
    p_location_id       := NULL,
    p_base_uom          := v_catalog.unit_abbr,
    p_secondary_uom     := NULL,
    p_track_secondary   := false,
    p_reorder_level     := v_catalog.reorder_level,
    p_min_stock_level   := v_catalog.min_stock_level,
    p_max_stock_level   := v_catalog.max_stock_level,
    p_unit_cost         := v_catalog.unit_cost,
    p_selling_price     := v_catalog.selling_price,
    p_status            := 'active',
    p_notes             := NULL
  );

  RETURN v_item_id;
END $function$;

GRANT EXECUTE ON FUNCTION public.ensure_partial_piece_parent_item(uuid, uuid) TO authenticated;