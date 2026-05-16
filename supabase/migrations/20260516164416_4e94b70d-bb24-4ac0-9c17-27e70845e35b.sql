CREATE OR REPLACE FUNCTION public.upsert_warehouse_inventory(
  p_company_id uuid,
  p_catalog_item_id uuid,
  p_location_id uuid DEFAULT NULL::uuid,
  p_base_uom text DEFAULT NULL::text,
  p_secondary_uom text DEFAULT NULL::text,
  p_track_secondary boolean DEFAULT false,
  p_reorder_level numeric DEFAULT NULL::numeric,
  p_min_stock_level numeric DEFAULT NULL::numeric,
  p_max_stock_level numeric DEFAULT NULL::numeric,
  p_unit_cost numeric DEFAULT NULL::numeric,
  p_selling_price numeric DEFAULT NULL::numeric,
  p_status text DEFAULT 'active'::text,
  p_notes text DEFAULT NULL::text
)
RETURNS uuid
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
DECLARE
  v_id   uuid;
  v_user uuid := auth.uid();
BEGIN
  IF p_company_id IS NULL OR p_catalog_item_id IS NULL THEN
    RAISE EXCEPTION 'company_id and catalog_item_id are required';
  END IF;

  -- Stage 6b: item_code/name no longer exist on warehouse_items — master fields
  -- live solely in warehouse_item_catalog.
  INSERT INTO public.warehouse_items (
    company_id, catalog_item_id, location_id,
    base_uom, secondary_uom, track_secondary_quantity,
    reorder_level, min_stock_level, max_stock_level,
    unit_cost, selling_price, status, notes, created_by
  ) VALUES (
    p_company_id, p_catalog_item_id, p_location_id,
    p_base_uom, p_secondary_uom, COALESCE(p_track_secondary, false),
    p_reorder_level, p_min_stock_level, p_max_stock_level,
    p_unit_cost, p_selling_price, COALESCE(p_status, 'active'), p_notes, v_user
  )
  ON CONFLICT (company_id, catalog_item_id) DO UPDATE
  SET
    location_id              = COALESCE(EXCLUDED.location_id, public.warehouse_items.location_id),
    base_uom                 = COALESCE(EXCLUDED.base_uom, public.warehouse_items.base_uom),
    secondary_uom            = COALESCE(EXCLUDED.secondary_uom, public.warehouse_items.secondary_uom),
    track_secondary_quantity = COALESCE(EXCLUDED.track_secondary_quantity, public.warehouse_items.track_secondary_quantity),
    reorder_level            = COALESCE(EXCLUDED.reorder_level, public.warehouse_items.reorder_level),
    min_stock_level          = COALESCE(EXCLUDED.min_stock_level, public.warehouse_items.min_stock_level),
    max_stock_level          = COALESCE(EXCLUDED.max_stock_level, public.warehouse_items.max_stock_level),
    unit_cost                = COALESCE(EXCLUDED.unit_cost, public.warehouse_items.unit_cost),
    selling_price            = COALESCE(EXCLUDED.selling_price, public.warehouse_items.selling_price),
    status                   = COALESCE(EXCLUDED.status, public.warehouse_items.status),
    notes                    = COALESCE(EXCLUDED.notes, public.warehouse_items.notes),
    updated_at               = now()
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$function$;