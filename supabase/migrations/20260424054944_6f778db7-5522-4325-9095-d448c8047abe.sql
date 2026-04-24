-- Phase 6: Composite index + materialized RPC for Tool Import dialog
-- Replaces 14 PostgREST round-trips with 1 server-side LEFT JOIN.

CREATE INDEX IF NOT EXISTS idx_warehouse_items_company_name
  ON public.warehouse_items (company_id, name);

CREATE OR REPLACE FUNCTION public.get_tool_candidate_items(
  p_company_ids   uuid[],
  p_category_ids  uuid[] DEFAULT NULL,
  p_location_id   uuid    DEFAULT NULL,
  p_limit         int     DEFAULT 20000
)
RETURNS TABLE (
  id uuid,
  item_code text,
  name text,
  description text,
  category_id uuid,
  category_name text,
  category_code text,
  unit_id uuid,
  unit_abbreviation text,
  current_stock numeric,
  unit_cost numeric,
  company_id uuid,
  location_id uuid
)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT
    i.id,
    i.item_code,
    i.name,
    i.description,
    i.category_id,
    c.name        AS category_name,
    c.code        AS category_code,
    i.unit_id,
    u.abbreviation AS unit_abbreviation,
    i.current_stock,
    i.unit_cost,
    i.company_id,
    i.location_id
  FROM public.warehouse_items i
  LEFT JOIN public.item_categories c ON c.id = i.category_id
  LEFT JOIN public.item_units      u ON u.id = i.unit_id
  WHERE i.company_id = ANY(p_company_ids)
    AND (p_category_ids IS NULL OR i.category_id = ANY(p_category_ids))
    AND (p_location_id  IS NULL OR i.location_id = p_location_id)
  ORDER BY i.name
  LIMIT COALESCE(p_limit, 20000);
$$;

GRANT EXECUTE ON FUNCTION public.get_tool_candidate_items(uuid[], uuid[], uuid, int) TO authenticated;