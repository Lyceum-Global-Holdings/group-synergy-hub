CREATE OR REPLACE FUNCTION public.get_effective_locations_for_company(p_company_id uuid)
RETURNS TABLE (id uuid, name text, type text, parent_id uuid)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT can_access_company(p_company_id) THEN
    RETURN;
  END IF;

  RETURN QUERY
  WITH RECURSIVE chain AS (
    SELECT
      wl.id AS origin_id,
      wl.id AS current_id,
      wl.company_assignment_mode,
      wl.parent_id,
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
    JOIN warehouse_locations wl ON wl.id = c.parent_id
    WHERE c.company_assignment_mode = 'inherit_parent'
      AND c.depth < 20
  ),
  resolved AS (
    SELECT DISTINCT ON (origin_id) origin_id, current_id
    FROM chain
    WHERE company_assignment_mode = 'explicit' OR parent_id IS NULL
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
  )
  SELECT wl.id, wl.name, wl.type, wl.parent_id
  FROM warehouse_locations wl
  JOIN matched m ON m.origin_id = wl.id
  WHERE wl.status IS DISTINCT FROM 'inactive'
  ORDER BY
    CASE wl.type WHEN 'location' THEN 0 WHEN 'sublocation' THEN 1 ELSE 2 END,
    wl.name;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_effective_locations_for_company(uuid) TO authenticated;