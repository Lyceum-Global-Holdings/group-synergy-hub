-- Phase 9.1.1 — Force per-call planning to avoid generic-plan slowdown.
-- Raw query runs in ~80ms; wrapped in LANGUAGE sql it took 7.8s due to a
-- bad generic plan. plpgsql + RETURN QUERY re-plans with actual params.

CREATE OR REPLACE FUNCTION public.get_tool_catalog_candidates(
  p_search                 text     DEFAULT NULL,
  p_category_ids           uuid[]   DEFAULT NULL,
  p_include_all_categories boolean  DEFAULT false,
  p_target_company_id      uuid     DEFAULT NULL,
  p_target_location_id     uuid     DEFAULT NULL,
  p_limit                  int      DEFAULT 20000
)
RETURNS TABLE (
  id                    uuid,
  item_code             text,
  name                  text,
  description           text,
  category_id           uuid,
  unit_id               uuid,
  unit_cost             numeric,
  image_url             text,
  status                text,
  category_name         text,
  category_code         text,
  unit_abbreviation     text,
  inventory_item_id     uuid,
  current_stock         numeric,
  inventory_location_id uuid
)
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path = public
SET plan_cache_mode = force_custom_plan
AS $$
BEGIN
  RETURN QUERY
  WITH inv AS (
    SELECT DISTINCT ON (i.catalog_item_id)
           i.catalog_item_id,
           i.id          AS inventory_item_id,
           i.current_stock,
           i.location_id AS inventory_location_id
    FROM public.warehouse_items i
    WHERE i.catalog_item_id IS NOT NULL
      AND (p_target_company_id  IS NULL OR i.company_id  = p_target_company_id)
      AND (p_target_location_id IS NULL OR i.location_id = p_target_location_id)
    ORDER BY i.catalog_item_id, i.updated_at DESC NULLS LAST
  )
  SELECT
    c.id,
    c.item_code,
    c.name,
    c.description,
    c.category_id,
    c.unit_id,
    c.unit_cost,
    c.image_url,
    c.status,
    cat.name        AS category_name,
    cat.code        AS category_code,
    u.abbreviation  AS unit_abbreviation,
    inv.inventory_item_id,
    inv.current_stock,
    inv.inventory_location_id
  FROM public.warehouse_item_catalog c
  LEFT JOIN public.item_categories cat ON cat.id = c.category_id
  LEFT JOIN public.item_units      u   ON u.id   = c.unit_id
  LEFT JOIN inv                        ON inv.catalog_item_id = c.id
  WHERE c.status = 'active'
    AND (
      p_include_all_categories
      OR p_category_ids IS NULL
      OR c.category_id = ANY(p_category_ids)
    )
    AND (
      p_search IS NULL
      OR p_search = ''
      OR c.name      ILIKE '%' || p_search || '%'
      OR c.item_code ILIKE '%' || p_search || '%'
      OR COALESCE(c.brand,'')   ILIKE '%' || p_search || '%'
      OR COALESCE(c.barcode,'') ILIKE '%' || p_search || '%'
      OR COALESCE(c.sku,'')     ILIKE '%' || p_search || '%'
    )
  ORDER BY c.name ASC, c.item_code ASC
  LIMIT COALESCE(p_limit, 20000);
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_tool_catalog_candidates(
  text, uuid[], boolean, uuid, uuid, int
) TO authenticated;