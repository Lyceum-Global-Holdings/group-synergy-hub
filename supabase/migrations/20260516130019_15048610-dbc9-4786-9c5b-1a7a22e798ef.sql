
DROP FUNCTION IF EXISTS public.list_partial_pieces(uuid,uuid,uuid,text,text,integer,integer);
DROP FUNCTION IF EXISTS public.list_partial_piece_items(uuid,uuid);

CREATE OR REPLACE FUNCTION public.warehouse_items_propagate_defaults_to_partial_pieces()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_old_default text := COALESCE(OLD.secondary_uom, OLD.base_uom);
  v_new_default text := COALESCE(NEW.secondary_uom, NEW.base_uom);
BEGIN
  IF v_new_default IS DISTINCT FROM v_old_default THEN
    UPDATE public.warehouse_partial_pieces
       SET size_uom = v_new_default, updated_at = now()
     WHERE parent_item_id = NEW.id
       AND status = 'available'
       AND size_uom IS NOT DISTINCT FROM v_old_default;
  END IF;

  IF NEW.unit_cost IS DISTINCT FROM OLD.unit_cost THEN
    UPDATE public.warehouse_partial_pieces
       SET unit_cost = NEW.unit_cost, updated_at = now()
     WHERE parent_item_id = NEW.id
       AND status = 'available'
       AND unit_cost IS NOT DISTINCT FROM OLD.unit_cost;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_warehouse_items_propagate_defaults ON public.warehouse_items;
CREATE TRIGGER trg_warehouse_items_propagate_defaults
AFTER UPDATE OF base_uom, secondary_uom, unit_cost ON public.warehouse_items
FOR EACH ROW
EXECUTE FUNCTION public.warehouse_items_propagate_defaults_to_partial_pieces();

CREATE FUNCTION public.list_partial_pieces(
  p_company_id uuid,
  p_location_id uuid DEFAULT NULL::uuid,
  p_parent_item_id uuid DEFAULT NULL::uuid,
  p_status text DEFAULT NULL::text,
  p_search text DEFAULT NULL::text,
  p_limit integer DEFAULT 500,
  p_offset integer DEFAULT 0
)
RETURNS TABLE(
  id uuid,
  piece_code text,
  parent_item_id uuid,
  parent_item_code text,
  parent_item_name text,
  base_uom text,
  secondary_uom text,
  track_secondary_quantity boolean,
  parent_item_status text,
  size_value numeric,
  size_uom text,
  location_id uuid,
  location_name text,
  bin_id uuid,
  bin_code text,
  status text,
  source_ref text,
  batch_number text,
  unit_cost numeric,
  label text,
  notes text,
  age_days integer,
  created_at timestamptz,
  updated_at timestamptz
)
LANGUAGE sql STABLE SET search_path = public AS $$
  SELECT
    p.id, p.piece_code, p.parent_item_id, i.item_code, i.name,
    i.base_uom, i.secondary_uom, i.track_secondary_quantity, i.status::text,
    p.size_value, p.size_uom,
    p.location_id, l.location_code, p.bin_id, b.bin_code,
    p.status::text, p.source_ref, p.batch_number, p.unit_cost, p.label, p.notes,
    GREATEST(0, EXTRACT(DAY FROM (now() - p.created_at))::int),
    p.created_at, p.updated_at
  FROM public.warehouse_partial_pieces p
  JOIN public.warehouse_items i ON i.id = p.parent_item_id
  JOIN public.warehouse_locations l ON l.id = p.location_id
  LEFT JOIN public.warehouse_bins b ON b.id = p.bin_id
  WHERE p.company_id = p_company_id
    AND (p_location_id IS NULL OR p.location_id = p_location_id)
    AND (p_parent_item_id IS NULL OR p.parent_item_id = p_parent_item_id)
    AND (p_status IS NULL OR p.status::text = p_status)
    AND (
      p_search IS NULL OR p_search = '' OR
      p.piece_code ILIKE '%' || p_search || '%' OR
      i.item_code ILIKE '%' || p_search || '%' OR
      i.name ILIKE '%' || p_search || '%' OR
      COALESCE(p.label,'') ILIKE '%' || p_search || '%' OR
      COALESCE(p.source_ref,'') ILIKE '%' || p_search || '%'
    )
  ORDER BY p.created_at DESC
  LIMIT GREATEST(p_limit, 1) OFFSET GREATEST(p_offset, 0);
$$;

CREATE FUNCTION public.list_partial_piece_items(
  p_company_id uuid,
  p_location_id uuid DEFAULT NULL::uuid
)
RETURNS TABLE(
  parent_item_id uuid,
  item_code text,
  item_name text,
  base_uom text,
  secondary_uom text,
  piece_count bigint
)
LANGUAGE sql STABLE SET search_path = public AS $$
  SELECT
    i.id,
    i.item_code,
    i.name,
    i.base_uom,
    i.secondary_uom,
    COUNT(p.id) FILTER (
      WHERE p.company_id = p_company_id
        AND (p_location_id IS NULL OR p.location_id = p_location_id)
    ) AS piece_count
  FROM public.warehouse_items i
  LEFT JOIN public.warehouse_partial_pieces p
    ON p.parent_item_id = i.id
  WHERE i.company_id = p_company_id
    AND COALESCE(i.status::text, 'active') = 'active'
  GROUP BY i.id, i.item_code, i.name, i.base_uom, i.secondary_uom
  ORDER BY i.item_code;
$$;
