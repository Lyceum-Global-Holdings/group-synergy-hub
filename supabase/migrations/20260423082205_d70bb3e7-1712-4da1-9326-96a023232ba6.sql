
-- Canonical effective-location list RPCs (single source of truth)
-- Built directly on top of get_effective_location_company_ids(uuid),
-- the proven company-membership resolver. Eliminates duplicated hierarchy logic.

DROP FUNCTION IF EXISTS public.get_effective_locations_for_company(uuid);

CREATE OR REPLACE FUNCTION public.get_effective_locations_for_company(p_company_id uuid)
RETURNS TABLE (id uuid, name text, type text, parent_id uuid, depth integer)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_company_id IS NULL THEN
    RETURN;
  END IF;

  IF NOT can_access_company(p_company_id) THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT
    wl.id,
    wl.name,
    wl.type,
    wl.parent_id,
    (CASE wl.type WHEN 'location' THEN 0 WHEN 'sublocation' THEN 1 ELSE 2 END)::integer AS depth
  FROM public.warehouse_locations wl
  WHERE wl.status IS DISTINCT FROM 'inactive'
    AND EXISTS (
      SELECT 1
      FROM public.get_effective_location_company_ids(wl.id) ec
      WHERE ec.company_id = p_company_id
    )
  ORDER BY
    (CASE wl.type WHEN 'location' THEN 0 WHEN 'sublocation' THEN 1 ELSE 2 END),
    wl.name;
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
  SELECT
    wl.id,
    wl.name,
    wl.type,
    wl.parent_id,
    (CASE wl.type WHEN 'location' THEN 0 WHEN 'sublocation' THEN 1 ELSE 2 END)::integer AS depth
  FROM public.warehouse_locations wl
  WHERE wl.status IS DISTINCT FROM 'inactive'
    AND EXISTS (
      SELECT 1
      FROM public.get_effective_location_company_ids(wl.id) ec
      WHERE ec.company_id = ANY(v_accessible)
    )
  ORDER BY
    (CASE wl.type WHEN 'location' THEN 0 WHEN 'sublocation' THEN 1 ELSE 2 END),
    wl.name;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_effective_locations_for_companies(uuid[]) TO authenticated;
