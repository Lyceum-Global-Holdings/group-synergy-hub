
-- 1. Schema: add piece_count + original_piece_count
ALTER TABLE public.warehouse_partial_pieces
  ADD COLUMN IF NOT EXISTS piece_count integer NOT NULL DEFAULT 1
    CHECK (piece_count >= 0),
  ADD COLUMN IF NOT EXISTS original_piece_count integer NOT NULL DEFAULT 1
    CHECK (original_piece_count >= 1);

-- Backfill is implicit via DEFAULT 1.

-- 2. CREATE: accept piece_count
CREATE OR REPLACE FUNCTION public.create_partial_piece(p_payload jsonb)
RETURNS uuid LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
DECLARE
  v_company uuid := (p_payload->>'company_id')::uuid;
  v_item uuid := (p_payload->>'parent_item_id')::uuid;
  v_code text := NULLIF(p_payload->>'piece_code','');
  v_uom text := NULLIF(p_payload->>'size_uom','');
  v_cost numeric := NULLIF(p_payload->>'unit_cost','')::numeric;
  v_pieces int := COALESCE(NULLIF(p_payload->>'piece_count','')::int, 1);
  v_id uuid;
  v_item_row record;
BEGIN
  IF v_company IS NULL OR v_item IS NULL THEN
    RAISE EXCEPTION 'company_id and parent_item_id are required';
  END IF;
  IF v_pieces < 1 THEN
    RAISE EXCEPTION 'piece_count must be >= 1';
  END IF;

  SELECT secondary_uom, base_uom, unit_cost INTO v_item_row
    FROM public.warehouse_items WHERE id = v_item AND company_id = v_company;
  IF NOT FOUND THEN RAISE EXCEPTION 'parent item not found in company'; END IF;

  IF v_uom IS NULL THEN v_uom := COALESCE(v_item_row.secondary_uom, v_item_row.base_uom); END IF;
  IF v_uom IS NULL THEN RAISE EXCEPTION 'size_uom required (item has no secondary UOM)'; END IF;
  IF v_cost IS NULL THEN v_cost := v_item_row.unit_cost; END IF;
  IF v_code IS NULL THEN v_code := public.next_partial_piece_code(v_company); END IF;

  INSERT INTO public.warehouse_partial_pieces(
    company_id, piece_code, parent_item_id, size_value, size_uom,
    location_id, bin_id, source_ref, batch_number, unit_cost, label, notes,
    piece_count, original_piece_count, created_by
  ) VALUES (
    v_company, v_code, v_item,
    (p_payload->>'size_value')::numeric, v_uom,
    (p_payload->>'location_id')::uuid,
    NULLIF(p_payload->>'bin_id','')::uuid,
    NULLIF(p_payload->>'source_ref',''),
    NULLIF(p_payload->>'batch_number',''),
    v_cost,
    NULLIF(p_payload->>'label',''),
    NULLIF(p_payload->>'notes',''),
    v_pieces, v_pieces,
    auth.uid()
  ) RETURNING id INTO v_id;
  RETURN v_id;
END $$;

-- 3. BULK: forward piece_count from each row into payload
CREATE OR REPLACE FUNCTION public.create_partial_pieces_bulk(
  p_company_id uuid,
  p_parent_item_id uuid,
  p_location_id uuid,
  p_bin_id uuid,
  p_shared jsonb,
  p_rows jsonb
)
RETURNS SETOF uuid
LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
DECLARE
  v_row jsonb;
  v_payload jsonb;
  v_id uuid;
BEGIN
  IF p_company_id IS NULL OR p_parent_item_id IS NULL OR p_location_id IS NULL THEN
    RAISE EXCEPTION 'company_id, parent_item_id and location_id are required';
  END IF;
  IF p_rows IS NULL OR jsonb_typeof(p_rows) <> 'array' OR jsonb_array_length(p_rows) = 0 THEN
    RAISE EXCEPTION 'p_rows must be a non-empty JSON array';
  END IF;
  IF jsonb_array_length(p_rows) > 200 THEN
    RAISE EXCEPTION 'Cannot create more than 200 partial pieces per batch (got %)', jsonb_array_length(p_rows);
  END IF;

  FOR v_row IN SELECT * FROM jsonb_array_elements(p_rows)
  LOOP
    IF (v_row->>'size_value') IS NULL OR (v_row->>'size_value')::numeric <= 0 THEN
      RAISE EXCEPTION 'Each row must have size_value > 0';
    END IF;

    v_payload := COALESCE(p_shared, '{}'::jsonb)
      || jsonb_build_object(
           'company_id', p_company_id,
           'parent_item_id', p_parent_item_id,
           'location_id', p_location_id,
           'bin_id', p_bin_id,
           'size_value', (v_row->>'size_value')::numeric
         );

    IF v_row ? 'piece_code' AND NULLIF(v_row->>'piece_code','') IS NOT NULL THEN
      v_payload := v_payload || jsonb_build_object('piece_code', v_row->>'piece_code');
    END IF;
    IF v_row ? 'label' AND NULLIF(v_row->>'label','') IS NOT NULL THEN
      v_payload := v_payload || jsonb_build_object('label', v_row->>'label');
    END IF;
    IF v_row ? 'piece_count' AND NULLIF(v_row->>'piece_count','') IS NOT NULL THEN
      v_payload := v_payload || jsonb_build_object('piece_count', (v_row->>'piece_count')::int);
    END IF;

    v_id := public.create_partial_piece(v_payload);
    RETURN NEXT v_id;
  END LOOP;
END $$;

-- 4. LIST: expose piece_count + total_size_value
DROP FUNCTION IF EXISTS public.list_partial_pieces(uuid,uuid,uuid,text,text,integer,integer);
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
  piece_count integer,
  original_piece_count integer,
  total_size_value numeric,
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
    p.piece_count, p.original_piece_count,
    (p.size_value * p.piece_count)::numeric AS total_size_value,
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

-- 5. IMPORT: accept piece_count column
CREATE OR REPLACE FUNCTION public.import_partial_pieces(
  p_company_id uuid, p_rows jsonb
) RETURNS jsonb
LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
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
      SELECT id, secondary_uom, base_uom, unit_cost
        INTO v_item_id, v_item_secondary_uom, v_item_base_uom, v_item_default_cost
        FROM public.warehouse_items
       WHERE company_id = p_company_id
         AND lower(item_code) = lower(v_row->>'parent_item_code');
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
END $$;

-- 6. New consume RPC: pieces + optional residual on last piece
CREATE OR REPLACE FUNCTION public.consume_partial_piece_pieces(
  p_id uuid,
  p_pieces int,
  p_residual_size numeric,
  p_reason text,
  p_post_to_stock boolean DEFAULT false,
  p_reference text DEFAULT NULL,
  p_notes text DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
DECLARE
  v_p record;
  v_new_status public.partial_piece_status;
  v_residual_id uuid;
  v_tx_id uuid;
  v_total_consumed numeric;
  v_remaining_pieces int;
  v_residual numeric := COALESCE(p_residual_size, 0);
BEGIN
  SELECT * INTO v_p FROM public.warehouse_partial_pieces WHERE id = p_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'piece not found'; END IF;
  IF v_p.status NOT IN ('available','reserved') THEN
    RAISE EXCEPTION 'piece already %', v_p.status;
  END IF;
  IF p_pieces IS NULL OR p_pieces < 0 OR p_pieces > v_p.piece_count THEN
    RAISE EXCEPTION 'invalid pieces (must be between 0 and %)', v_p.piece_count;
  END IF;
  IF v_residual < 0 OR v_residual >= v_p.size_value THEN
    RAISE EXCEPTION 'residual_size must be between 0 and < %', v_p.size_value;
  END IF;
  IF p_pieces = 0 AND v_residual = 0 THEN
    RAISE EXCEPTION 'nothing to consume';
  END IF;
  IF p_pieces = v_p.piece_count AND v_residual > 0 THEN
    RAISE EXCEPTION 'residual_size only valid when at least 1 piece is left';
  END IF;
  IF p_reason IS NULL OR p_reason = '' THEN
    RAISE EXCEPTION 'reason required';
  END IF;

  v_total_consumed := p_pieces * v_p.size_value + v_residual;
  v_remaining_pieces := v_p.piece_count - p_pieces;
  v_new_status := CASE WHEN p_reason = 'scrap' THEN 'scrapped' ELSE 'consumed' END;

  IF v_remaining_pieces = 0 THEN
    -- Entire group consumed
    UPDATE public.warehouse_partial_pieces
       SET status = v_new_status,
           consumed_at = now(),
           consumed_by = auth.uid(),
           consumed_qty = v_p.size_value * v_p.piece_count,
           consumed_reason = p_reason,
           piece_count = 0,
           notes = COALESCE(notes,'') ||
                   CASE WHEN p_notes IS NOT NULL AND p_notes <> '' THEN E'\n[consume] ' || p_notes ELSE '' END
     WHERE id = p_id;
  ELSE
    -- Partial: decrement group; optionally peel residual
    UPDATE public.warehouse_partial_pieces
       SET piece_count = v_remaining_pieces,
           notes = COALESCE(notes,'') ||
                   CASE WHEN p_notes IS NOT NULL AND p_notes <> '' THEN E'\n[consume] ' || p_notes ELSE '' END
     WHERE id = p_id;

    IF v_residual > 0 THEN
      -- Peel the partially-consumed piece into a smaller residual record
      UPDATE public.warehouse_partial_pieces
         SET piece_count = v_remaining_pieces - 1
       WHERE id = p_id;

      INSERT INTO public.warehouse_partial_pieces(
        company_id, piece_code, parent_item_id, size_value, size_uom,
        location_id, bin_id, source_ref, batch_number, unit_cost, label,
        parent_piece_id, piece_count, original_piece_count, created_by
      ) VALUES (
        v_p.company_id, public.next_partial_piece_code(v_p.company_id),
        v_p.parent_item_id, (v_p.size_value - v_residual), v_p.size_uom,
        v_p.location_id, v_p.bin_id,
        'split-from:' || v_p.piece_code,
        v_p.batch_number, v_p.unit_cost,
        v_p.label, v_p.id, 1, 1, auth.uid()
      ) RETURNING id INTO v_residual_id;
    END IF;
  END IF;

  IF p_post_to_stock THEN
    INSERT INTO public.stock_transactions(
      company_id, item_id, location_id, bin_id,
      transaction_type, quantity_change, secondary_quantity_change, secondary_uom,
      unit_cost, notes, created_by
    ) VALUES (
      v_p.company_id, v_p.parent_item_id, v_p.location_id, v_p.bin_id,
      'issue', 0, -v_total_consumed, v_p.size_uom,
      v_p.unit_cost,
      '[partial-piece:' || v_p.piece_code || '] reason:' || p_reason ||
        ' / pieces:' || p_pieces || (CASE WHEN v_residual > 0 THEN ' +residual:' || v_residual ELSE '' END) ||
        COALESCE(' / ref:' || p_reference, '') ||
        COALESCE(' / ' || p_notes, ''),
      auth.uid()
    ) RETURNING id INTO v_tx_id;
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'pieces_consumed', p_pieces,
    'residual_size', v_residual,
    'total_consumed', v_total_consumed,
    'remaining_pieces', GREATEST(v_remaining_pieces - CASE WHEN v_residual > 0 THEN 1 ELSE 0 END, 0),
    'residual_id', v_residual_id,
    'transaction_id', v_tx_id
  );
END $$;

GRANT EXECUTE ON FUNCTION public.consume_partial_piece_pieces(uuid,int,numeric,text,boolean,text,text) TO authenticated;
