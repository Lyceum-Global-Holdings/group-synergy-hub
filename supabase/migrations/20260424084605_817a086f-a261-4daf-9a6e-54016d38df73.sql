CREATE OR REPLACE FUNCTION public.get_tool_catalog_candidate_counts(
  p_target_company_id uuid DEFAULT NULL,
  p_tool_category_ids uuid[] DEFAULT NULL
)
RETURNS TABLE (
  all_count bigint,
  tools_count bigint,
  suggested_count bigint
)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  WITH excluded AS (
    SELECT DISTINCT catalog_item_id
    FROM warehouse_tools
    WHERE p_target_company_id IS NOT NULL
      AND company_id = p_target_company_id
      AND catalog_item_id IS NOT NULL
  ),
  excluded_codes AS (
    SELECT DISTINCT lower(tool_code) AS code
    FROM warehouse_tools
    WHERE p_target_company_id IS NOT NULL
      AND company_id = p_target_company_id
      AND catalog_item_id IS NULL
      AND tool_code IS NOT NULL
  ),
  base AS (
    SELECT c.id, c.category_id, lower(c.item_code) AS item_code_lc
    FROM warehouse_item_catalog c
    WHERE c.status = 'active'
      AND NOT EXISTS (SELECT 1 FROM excluded e WHERE e.catalog_item_id = c.id)
      AND NOT EXISTS (SELECT 1 FROM excluded_codes ec WHERE ec.code = lower(c.item_code))
  )
  SELECT
    count(*)::bigint AS all_count,
    count(*) FILTER (
      WHERE p_tool_category_ids IS NOT NULL
        AND category_id = ANY(p_tool_category_ids)
    )::bigint AS tools_count,
    count(*) FILTER (
      WHERE p_tool_category_ids IS NOT NULL
        AND category_id = ANY(p_tool_category_ids)
    )::bigint AS suggested_count
  FROM base;
$$;

GRANT EXECUTE ON FUNCTION public.get_tool_catalog_candidate_counts(uuid, uuid[]) TO authenticated;