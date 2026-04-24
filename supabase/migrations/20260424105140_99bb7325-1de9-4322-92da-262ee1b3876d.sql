-- Phase 9.4 — single-row diagnostic lookup for the Tool Import dialog.
-- SECURITY INVOKER so RLS still applies; STABLE so it's planner-friendly.
CREATE OR REPLACE FUNCTION public.find_catalog_item_by_code(
  p_code text,
  p_target_company_id uuid DEFAULT NULL
)
RETURNS TABLE(
  found boolean,
  catalog_id uuid,
  item_code text,
  name text,
  status text,
  category_id uuid,
  category_name text,
  already_imported boolean,
  tool_id uuid,
  tool_name text
)
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path TO 'public'
AS $$
DECLARE
  v_norm_code text;
BEGIN
  v_norm_code := lower(btrim(coalesce(p_code, '')));

  IF v_norm_code = '' THEN
    RETURN;
  END IF;

  RETURN QUERY
  WITH cat AS (
    SELECT c.id, c.item_code, c.name, c.status, c.category_id
    FROM public.warehouse_item_catalog c
    WHERE lower(c.item_code) = v_norm_code
    LIMIT 1
  ),
  tool AS (
    SELECT t.id AS tool_id, t.name AS tool_name
    FROM public.warehouse_tools t
    WHERE p_target_company_id IS NOT NULL
      AND t.company_id = p_target_company_id
      AND (
        (t.catalog_item_id IS NOT NULL AND t.catalog_item_id = (SELECT id FROM cat))
        OR (t.catalog_item_id IS NULL AND lower(t.tool_code) = v_norm_code)
      )
    LIMIT 1
  )
  SELECT
    true                                        AS found,
    cat.id                                      AS catalog_id,
    cat.item_code                               AS item_code,
    cat.name                                    AS name,
    cat.status                                  AS status,
    cat.category_id                             AS category_id,
    ic.name                                     AS category_name,
    (tool.tool_id IS NOT NULL)                  AS already_imported,
    tool.tool_id                                AS tool_id,
    tool.tool_name                              AS tool_name
  FROM cat
  LEFT JOIN public.item_categories ic ON ic.id = cat.category_id
  LEFT JOIN tool ON true;
END;
$$;

GRANT EXECUTE ON FUNCTION public.find_catalog_item_by_code(text, uuid) TO authenticated;