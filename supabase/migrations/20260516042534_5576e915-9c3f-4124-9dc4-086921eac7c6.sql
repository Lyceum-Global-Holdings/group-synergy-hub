CREATE OR REPLACE FUNCTION public.get_company_inventory_at_location(p_company_id uuid, p_location_id uuid)
RETURNS SETOF public.warehouse_items
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  scope_ids uuid[];
BEGIN
  IF p_company_id IS NULL OR p_location_id IS NULL THEN
    RETURN;
  END IF;

  IF NOT public.can_access_company(p_company_id) THEN
    RETURN;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.get_effective_location_company_ids(p_location_id) ec
    WHERE ec.company_id = p_company_id
  ) THEN
    RETURN;
  END IF;

  SELECT array_agg(location_id)
  INTO scope_ids
  FROM public.get_location_subtree_ids(p_location_id);

  IF scope_ids IS NULL OR cardinality(scope_ids) = 0 THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT DISTINCT ON (wi.created_at, wi.id) wi.*
  FROM public.warehouse_items wi
  WHERE wi.company_id = p_company_id
    AND (
      (wi.location_id = ANY(scope_ids) AND COALESCE(wi.current_stock, 0) > 0)
      OR EXISTS (
        SELECT 1
        FROM public.warehouse_bin_allocations wba
        JOIN public.warehouse_bins wb ON wb.id = wba.bin_id
        WHERE wba.warehouse_item_id = wi.id
          AND wb.location_id = ANY(scope_ids)
          AND wba.available_quantity > 0
      )
    )
  ORDER BY wi.created_at DESC, wi.id DESC;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.get_company_inventory_at_location(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_company_inventory_at_location(uuid, uuid) TO authenticated;