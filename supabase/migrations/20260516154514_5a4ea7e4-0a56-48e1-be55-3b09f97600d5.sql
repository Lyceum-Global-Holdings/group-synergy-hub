
-- 1) list_partial_piece_items: join catalog for code/name
CREATE OR REPLACE FUNCTION public.list_partial_piece_items(p_company_id uuid, p_location_id uuid DEFAULT NULL::uuid)
RETURNS TABLE(parent_item_id uuid, item_code text, item_name text, base_uom text, secondary_uom text, unit_cost numeric, track_secondary_quantity boolean, piece_count bigint)
LANGUAGE sql
STABLE
SET search_path TO 'public'
AS $function$
  SELECT
    i.id,
    c.item_code,
    c.name,
    i.base_uom,
    i.secondary_uom,
    i.unit_cost,
    COALESCE(i.track_secondary_quantity, false),
    COUNT(p.id) FILTER (
      WHERE p.company_id = p_company_id
        AND (p_location_id IS NULL OR p.location_id = p_location_id)
    ) AS piece_count
  FROM public.warehouse_items i
  JOIN public.warehouse_item_catalog c ON c.id = i.catalog_item_id
  LEFT JOIN public.warehouse_partial_pieces p
    ON p.parent_item_id = i.id
  WHERE i.company_id = p_company_id
    AND COALESCE(i.status::text, 'active') = 'active'
  GROUP BY i.id, c.item_code, c.name, i.base_uom, i.secondary_uom, i.unit_cost, i.track_secondary_quantity
  ORDER BY c.item_code;
$function$;

-- 2) list_partial_pieces: join catalog for code/name and search
CREATE OR REPLACE FUNCTION public.list_partial_pieces(p_company_id uuid, p_location_id uuid DEFAULT NULL::uuid, p_parent_item_id uuid DEFAULT NULL::uuid, p_status text DEFAULT NULL::text, p_search text DEFAULT NULL::text, p_limit integer DEFAULT 500, p_offset integer DEFAULT 0)
RETURNS TABLE(id uuid, piece_code text, parent_item_id uuid, parent_item_code text, parent_item_name text, base_uom text, secondary_uom text, track_secondary_quantity boolean, parent_item_status text, size_value numeric, size_uom text, piece_count integer, original_piece_count integer, total_size_value numeric, location_id uuid, location_name text, bin_id uuid, bin_code text, status text, source_ref text, batch_number text, unit_cost numeric, label text, notes text, age_days integer, created_at timestamp with time zone, updated_at timestamp with time zone)
LANGUAGE sql
STABLE
SET search_path TO 'public'
AS $function$
  SELECT
    p.id, p.piece_code, p.parent_item_id, c.item_code, c.name,
    i.base_uom, i.secondary_uom, i.track_secondary_quantity, i.status::text,
    p.size_value, p.size_uom,
    p.piece_count, p.original_piece_count,
    (p.size_value * p.piece_count)::numeric AS total_size_value,
    p.location_id, l.location_code, p.bin_id, b.bin_code,
    p.status::text, p.source_ref, p.batch_number, p.unit_cost, p.label, p.notes,
    GREATEST(0, EXTRACT(DAY FROM (now() - p.created_at))::int),
    p.created_at, p.updated_at
  FROM public.warehouse_partial_pieces p
  JOIN public.warehouse_items i ON i.id = p.parent_item_id
  JOIN public.warehouse_item_catalog c ON c.id = i.catalog_item_id
  JOIN public.warehouse_locations l ON l.id = p.location_id
  LEFT JOIN public.warehouse_bins b ON b.id = p.bin_id
  WHERE p.company_id = p_company_id
    AND (p_location_id IS NULL OR p.location_id = p_location_id)
    AND (p_parent_item_id IS NULL OR p.parent_item_id = p_parent_item_id)
    AND (p_status IS NULL OR p.status::text = p_status)
    AND (
      p_search IS NULL OR p_search = '' OR
      p.piece_code ILIKE '%' || p_search || '%' OR
      c.item_code ILIKE '%' || p_search || '%' OR
      c.name ILIKE '%' || p_search || '%' OR
      COALESCE(p.label,'') ILIKE '%' || p_search || '%' OR
      COALESCE(p.source_ref,'') ILIKE '%' || p_search || '%'
    )
  ORDER BY p.created_at DESC
  LIMIT GREATEST(p_limit, 1) OFFSET GREATEST(p_offset, 0);
$function$;

-- 3) next_partial_piece_code_for_item: read item_code via catalog
CREATE OR REPLACE FUNCTION public.next_partial_piece_code_for_item(p_company_id uuid, p_parent_item_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_item_code text;
  v_prefix text;
  v_seq int;
BEGIN
  SELECT c.item_code INTO v_item_code
    FROM public.warehouse_items i
    JOIN public.warehouse_item_catalog c ON c.id = i.catalog_item_id
   WHERE i.id = p_parent_item_id AND i.company_id = p_company_id;
  IF v_item_code IS NULL THEN
    RAISE EXCEPTION 'parent item not found in company';
  END IF;

  v_prefix := v_item_code || '/PQ-';

  PERFORM pg_advisory_xact_lock(
    hashtextextended(p_company_id::text || ':' || p_parent_item_id::text, 0)
  );

  SELECT COALESCE(MAX(NULLIF(regexp_replace(piece_code, '^' || regexp_replace(v_prefix, '([\.\\\+\*\?\(\)\[\]\{\}\|\^\$])', '\\\1', 'g'), ''), '')::int), 0) + 1
    INTO v_seq
    FROM public.warehouse_partial_pieces
   WHERE company_id = p_company_id
     AND parent_item_id = p_parent_item_id
     AND piece_code LIKE v_prefix || '%'
     AND piece_code ~ ('^' || regexp_replace(v_prefix, '([\.\\\+\*\?\(\)\[\]\{\}\|\^\$])', '\\\1', 'g') || '[0-9]+$');

  RETURN v_prefix || lpad(v_seq::text, 4, '0');
END $function$;

-- 4) import_partial_pieces: lookup item by catalog item_code
CREATE OR REPLACE FUNCTION public.import_partial_pieces(p_company_id uuid, p_rows jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
DECLARE
  v_row jsonb;
  v_idx int := 0;
  v_inserted int := 0;
  v_errors jsonb := '[]'::jsonb;
  v_item_id uuid; v_loc_id uuid; v_bin_id uuid;
  v_uom text; v_cost numeric;
  v_code text;
  v_pieces int;
  v_item_secondary_uom text; v_item_base_uom text; v_item_default_cost numeric;
BEGIN
  IF p_company_id IS NULL THEN RAISE EXCEPTION 'company_id required'; END IF;

  FOR v_row IN SELECT * FROM jsonb_array_elements(COALESCE(p_rows, '[]'::jsonb))
  LOOP
    v_idx := v_idx + 1;
    BEGIN
      SELECT i.id, i.secondary_uom, i.base_uom, i.unit_cost
        INTO v_item_id, v_item_secondary_uom, v_item_base_uom, v_item_default_cost
        FROM public.warehouse_items i
        JOIN public.warehouse_item_catalog c ON c.id = i.catalog_item_id
       WHERE i.company_id = p_company_id
         AND lower(c.item_code) = lower(v_row->>'parent_item_code');
      IF v_item_id IS NULL THEN RAISE EXCEPTION 'item code not found'; END IF;

      SELECT id INTO v_loc_id FROM public.warehouse_locations
        WHERE company_id = p_company_id AND lower(location_code) = lower(v_row->>'location_code');
      IF v_loc_id IS NULL THEN RAISE EXCEPTION 'location code not found'; END IF;

      v_bin_id := NULL;
      IF NULLIF(v_row->>'bin_code','') IS NOT NULL THEN
        SELECT id INTO v_bin_id FROM public.warehouse_bins
          WHERE company_id = p_company_id
            AND location_id = v_loc_id
            AND lower(bin_code) = lower(v_row->>'bin_code');
        IF v_bin_id IS NULL THEN RAISE EXCEPTION 'bin code not found in location'; END IF;
      END IF;

      v_uom := COALESCE(NULLIF(v_row->>'size_uom',''), v_item_secondary_uom, v_item_base_uom);
      IF v_uom IS NULL THEN RAISE EXCEPTION 'size_uom missing (item has no secondary UOM)'; END IF;
      v_cost := COALESCE(NULLIF(v_row->>'unit_cost','')::numeric, v_item_default_cost);
      v_code := COALESCE(NULLIF(v_row->>'piece_code',''), public.next_partial_piece_code(p_company_id));
      v_pieces := COALESCE(NULLIF(v_row->>'quantity','')::int, NULLIF(v_row->>'piece_count','')::int, 1);
      IF v_pieces < 1 THEN RAISE EXCEPTION 'quantity must be >= 1'; END IF;

      INSERT INTO public.warehouse_partial_pieces(
        company_id, piece_code, parent_item_id, size_value, size_uom,
        location_id, bin_id, source_ref, batch_number, unit_cost, label, notes,
        piece_count, original_piece_count, created_by
      ) VALUES (
        p_company_id, v_code, v_item_id,
        (v_row->>'size_value')::numeric, v_uom,
        v_loc_id, v_bin_id,
        NULLIF(v_row->>'source_ref',''),
        NULLIF(v_row->>'batch_number',''),
        v_cost,
        NULLIF(v_row->>'label',''),
        NULLIF(v_row->>'notes',''),
        v_pieces, v_pieces,
        auth.uid()
      );
      v_inserted := v_inserted + 1;
    EXCEPTION WHEN OTHERS THEN
      v_errors := v_errors || jsonb_build_object('row', v_idx, 'error', SQLERRM, 'data', v_row);
    END;
  END LOOP;

  RETURN jsonb_build_object('inserted', v_inserted, 'errors', v_errors);
END $function$;
