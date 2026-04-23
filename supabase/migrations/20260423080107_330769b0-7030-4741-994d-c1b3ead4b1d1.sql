DROP FUNCTION IF EXISTS public.get_effective_locations_for_company(uuid);

CREATE OR REPLACE FUNCTION public.get_effective_locations_for_company(p_company_id uuid)
RETURNS TABLE (id uuid, name text, type text, parent_id uuid, depth integer)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT can_access_company(p_company_id) THEN
    RETURN;
  END IF;

  RETURN QUERY
  WITH RECURSIVE chain AS (
    SELECT
      wl.id AS origin_id,
      wl.id AS current_id,
      wl.company_assignment_mode AS mode,
      wl.parent_id AS p_id,
      0 AS depth
    FROM warehouse_locations wl
    WHERE wl.status IS DISTINCT FROM 'inactive'
    UNION ALL
    SELECT
      c.origin_id,
      wl.id,
      wl.company_assignment_mode,
      wl.parent_id,
      c.depth + 1
    FROM chain c
    JOIN warehouse_locations wl ON wl.id = c.p_id
    WHERE c.mode = 'inherit_parent'
      AND c.depth < 20
  ),
  resolved AS (
    SELECT DISTINCT ON (origin_id) origin_id, current_id
    FROM chain
    WHERE mode = 'explicit' OR p_id IS NULL
    ORDER BY origin_id, depth ASC
  ),
  matched AS (
    SELECT DISTINCT r.origin_id
    FROM resolved r
    JOIN warehouse_location_companies wlc
      ON wlc.location_id = r.current_id
     AND wlc.company_id = p_company_id
    UNION
    SELECT wl.id
    FROM warehouse_locations wl
    WHERE wl.company_id = p_company_id
      AND wl.status IS DISTINCT FROM 'inactive'
  ),
  ranked AS (
    SELECT
      wl.id,
      wl.name,
      wl.type,
      wl.parent_id,
      CASE wl.type WHEN 'location' THEN 0 WHEN 'sublocation' THEN 1 ELSE 2 END AS d
    FROM warehouse_locations wl
    JOIN matched m ON m.origin_id = wl.id
    WHERE wl.status IS DISTINCT FROM 'inactive'
  )
  SELECT r.id, r.name, r.type, r.parent_id, r.d AS depth
  FROM ranked r
  ORDER BY r.d, r.name;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_effective_locations_for_company(uuid) TO authenticated;

DROP FUNCTION IF EXISTS public.get_effective_locations_for_companies(uuid[]);

CREATE OR REPLACE FUNCTION public.get_effective_locations_for_companies(p_company_ids uuid[])
RETURNS TABLE (id uuid, name text, type text, parent_id uuid, depth integer)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_accessible uuid[];
BEGIN
  IF p_company_ids IS NULL OR array_length(p_company_ids, 1) IS NULL THEN
    RETURN;
  END IF;

  SELECT COALESCE(array_agg(c), ARRAY[]::uuid[])
    INTO v_accessible
  FROM unnest(p_company_ids) AS c
  WHERE can_access_company(c);

  IF array_length(v_accessible, 1) IS NULL THEN
    RETURN;
  END IF;

  RETURN QUERY
  WITH RECURSIVE chain AS (
    SELECT
      wl.id AS origin_id,
      wl.id AS current_id,
      wl.company_assignment_mode AS mode,
      wl.parent_id AS p_id,
      0 AS depth
    FROM warehouse_locations wl
    WHERE wl.status IS DISTINCT FROM 'inactive'
    UNION ALL
    SELECT
      c.origin_id,
      wl.id,
      wl.company_assignment_mode,
      wl.parent_id,
      c.depth + 1
    FROM chain c
    JOIN warehouse_locations wl ON wl.id = c.p_id
    WHERE c.mode = 'inherit_parent'
      AND c.depth < 20
  ),
  resolved AS (
    SELECT DISTINCT ON (origin_id) origin_id, current_id
    FROM chain
    WHERE mode = 'explicit' OR p_id IS NULL
    ORDER BY origin_id, depth ASC
  ),
  matched AS (
    SELECT DISTINCT r.origin_id
    FROM resolved r
    JOIN warehouse_location_companies wlc
      ON wlc.location_id = r.current_id
     AND wlc.company_id = ANY(v_accessible)
    UNION
    SELECT wl.id
    FROM warehouse_locations wl
    WHERE wl.company_id = ANY(v_accessible)
      AND wl.status IS DISTINCT FROM 'inactive'
  ),
  ranked AS (
    SELECT
      wl.id,
      wl.name,
      wl.type,
      wl.parent_id,
      CASE wl.type WHEN 'location' THEN 0 WHEN 'sublocation' THEN 1 ELSE 2 END AS d
    FROM warehouse_locations wl
    JOIN matched m ON m.origin_id = wl.id
    WHERE wl.status IS DISTINCT FROM 'inactive'
  )
  SELECT r.id, r.name, r.type, r.parent_id, r.d AS depth
  FROM ranked r
  ORDER BY r.d, r.name;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_effective_locations_for_companies(uuid[]) TO authenticated;