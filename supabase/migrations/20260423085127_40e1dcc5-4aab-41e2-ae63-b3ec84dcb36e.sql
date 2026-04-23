CREATE OR REPLACE FUNCTION public.get_company_inventory_at_location(p_company_id uuid, p_location_id uuid)
RETURNS SETOF warehouse_items
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF p_company_id IS NULL OR p_location_id IS NULL THEN
    RETURN;
  END IF;

  IF NOT can_access_company(p_company_id) THEN
    RETURN;
  END IF;

  -- Verify the company actually has effective access to this location
  IF NOT EXISTS (
    SELECT 1
    FROM public.get_effective_location_company_ids(p_location_id) ec
    WHERE ec.company_id = p_company_id
  ) THEN
    RETURN;
  END IF;

  -- Return items physically present at the location, either via:
  --   (a) warehouse_items.location_id = p_location_id, OR
  --   (b) a bin allocation in a warehouse_bins row at p_location_id
  -- Strictly company-scoped, with stock > 0, ordered by created_at desc, id desc.
  RETURN QUERY
  SELECT DISTINCT ON (wi.created_at, wi.id) wi.*
  FROM public.warehouse_items wi
  WHERE wi.company_id = p_company_id
    AND wi.current_stock > 0
    AND (
      wi.location_id = p_location_id
      OR EXISTS (
        SELECT 1
        FROM public.warehouse_bin_allocations wba
        JOIN public.warehouse_bins wb ON wb.id = wba.bin_id
        WHERE wba.warehouse_item_id = wi.id
          AND wb.location_id = p_location_id
          AND wba.available_quantity > 0
      )
    )
  ORDER BY wi.created_at DESC, wi.id DESC;
END;
$function$;