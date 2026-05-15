
-- 1. New piece-code generator: derives from parent item_code with per-item sequence
CREATE OR REPLACE FUNCTION public.next_partial_piece_code_for_item(
  p_company_id uuid, p_parent_item_id uuid
)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_item_code text;
  v_prefix text;
  v_seq int;
BEGIN
  SELECT item_code INTO v_item_code
    FROM public.warehouse_items
   WHERE id = p_parent_item_id AND company_id = p_company_id;
  IF v_item_code IS NULL THEN
    RAISE EXCEPTION 'parent item not found in company';
  END IF;

  v_prefix := v_item_code || '/PQ-';

  -- Lock to serialise sequence per (company, parent_item)
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
END $$;

-- 2. CREATE: use new generator
CREATE OR REPLACE FUNCTION public.create_partial_piece(p_payload jsonb)
RETURNS uuid LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
DECLARE
  v_company uuid := (p_payload->>'company_id')::uuid;
  v_item uuid := (p_payload->>'parent_item_id')::uuid;
  v_code text := NULLIF(p_payload->>'piece_code','');
  v_uom text := NULLIF(p_payload->>'size_uom','');
  v_cost numeric := NULLIF(p_payload->>'unit_cost','')::numeric;
  v_id uuid;
  v_item_row record;
BEGIN
  IF v_company IS NULL OR v_item IS NULL THEN
    RAISE EXCEPTION 'company_id and parent_item_id are required';
  END IF;

  SELECT secondary_uom, base_uom, unit_cost INTO v_item_row
    FROM public.warehouse_items WHERE id = v_item AND company_id = v_company;
  IF NOT FOUND THEN RAISE EXCEPTION 'parent item not found in company'; END IF;

  IF v_uom IS NULL THEN v_uom := COALESCE(v_item_row.secondary_uom, v_item_row.base_uom); END IF;
  IF v_uom IS NULL THEN RAISE EXCEPTION 'size_uom required (item has no secondary UOM)'; END IF;
  IF v_cost IS NULL THEN v_cost := v_item_row.unit_cost; END IF;
  IF v_code IS NULL THEN v_code := public.next_partial_piece_code_for_item(v_company, v_item); END IF;

  INSERT INTO public.warehouse_partial_pieces(
    company_id, piece_code, parent_item_id, size_value, size_uom,
    location_id, bin_id, source_ref, batch_number, unit_cost, label, notes, created_by
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
    auth.uid()
  ) RETURNING id INTO v_id;
  RETURN v_id;
END $$;

-- 3. CONSUME: residual piece uses item-derived code
CREATE OR REPLACE FUNCTION public.consume_partial_piece(
  p_id uuid,
  p_quantity numeric,
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
  v_residual_size numeric;
BEGIN
  SELECT * INTO v_p FROM public.warehouse_partial_pieces WHERE id = p_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'piece not found'; END IF;
  IF v_p.status NOT IN ('available','reserved') THEN
    RAISE EXCEPTION 'piece already %', v_p.status;
  END IF;
  IF p_quantity IS NULL OR p_quantity <= 0 OR p_quantity > v_p.size_value THEN
    RAISE EXCEPTION 'invalid quantity (must be > 0 and <= %)', v_p.size_value;
  END IF;
  IF p_reason IS NULL OR p_reason = '' THEN
    RAISE EXCEPTION 'reason required';
  END IF;

  v_new_status := CASE WHEN p_reason = 'scrap' THEN 'scrapped' ELSE 'consumed' END;
  v_residual_size := v_p.size_value - p_quantity;

  UPDATE public.warehouse_partial_pieces
     SET status = v_new_status,
         consumed_at = now(),
         consumed_by = auth.uid(),
         consumed_qty = p_quantity,
         consumed_reason = p_reason,
         notes = COALESCE(notes,'') ||
                 CASE WHEN p_notes IS NOT NULL AND p_notes <> '' THEN E'\n[consume] ' || p_notes ELSE '' END
   WHERE id = p_id;

  IF v_residual_size > 0 THEN
    INSERT INTO public.warehouse_partial_pieces(
      company_id, piece_code, parent_item_id, size_value, size_uom,
      location_id, bin_id, source_ref, batch_number, unit_cost, label, parent_piece_id, created_by
    ) VALUES (
      v_p.company_id,
      public.next_partial_piece_code_for_item(v_p.company_id, v_p.parent_item_id),
      v_p.parent_item_id, v_residual_size, v_p.size_uom,
      v_p.location_id, v_p.bin_id,
      'split-from:' || v_p.piece_code,
      v_p.batch_number, v_p.unit_cost,
      v_p.label, v_p.id, auth.uid()
    ) RETURNING id INTO v_residual_id;
  END IF;

  IF p_post_to_stock THEN
    INSERT INTO public.stock_transactions(
      company_id, item_id, location_id, bin_id,
      transaction_type, quantity_change, secondary_quantity_change, secondary_uom,
      unit_cost, notes, created_by
    ) VALUES (
      v_p.company_id, v_p.parent_item_id, v_p.location_id, v_p.bin_id,
      'issue', 0, -p_quantity, v_p.size_uom,
      v_p.unit_cost,
      '[partial-piece:' || v_p.piece_code || '] reason:' || p_reason ||
        COALESCE(' / ref:' || p_reference, '') ||
        COALESCE(' / ' || p_notes, ''),
      auth.uid()
    ) RETURNING id INTO v_tx_id;
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'consumed_qty', p_quantity,
    'residual_id', v_residual_id,
    'transaction_id', v_tx_id
  );
END $$;

-- 4. SPLIT: both new pieces use item-derived codes
CREATE OR REPLACE FUNCTION public.split_partial_piece(
  p_id uuid, p_first_size numeric, p_second_size numeric
) RETURNS jsonb
LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
DECLARE
  v_p record;
  v_a uuid; v_b uuid;
BEGIN
  SELECT * INTO v_p FROM public.warehouse_partial_pieces WHERE id = p_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'piece not found'; END IF;
  IF v_p.status <> 'available' THEN RAISE EXCEPTION 'only available pieces can be split'; END IF;
  IF p_first_size IS NULL OR p_second_size IS NULL OR p_first_size <= 0 OR p_second_size <= 0 THEN
    RAISE EXCEPTION 'sizes must be > 0';
  END IF;
  IF round(p_first_size + p_second_size, 4) <> round(v_p.size_value, 4) THEN
    RAISE EXCEPTION 'split sizes must sum to %', v_p.size_value;
  END IF;

  UPDATE public.warehouse_partial_pieces
     SET status = 'consumed', consumed_at = now(), consumed_by = auth.uid(),
         consumed_qty = v_p.size_value, consumed_reason = 'split'
   WHERE id = p_id;

  INSERT INTO public.warehouse_partial_pieces(
    company_id, piece_code, parent_item_id, size_value, size_uom,
    location_id, bin_id, source_ref, batch_number, unit_cost, label, parent_piece_id, created_by
  ) VALUES (
    v_p.company_id,
    public.next_partial_piece_code_for_item(v_p.company_id, v_p.parent_item_id),
    v_p.parent_item_id, p_first_size, v_p.size_uom,
    v_p.location_id, v_p.bin_id,
    'split-from:' || v_p.piece_code, v_p.batch_number, v_p.unit_cost,
    v_p.label, v_p.id, auth.uid()
  ) RETURNING id INTO v_a;

  INSERT INTO public.warehouse_partial_pieces(
    company_id, piece_code, parent_item_id, size_value, size_uom,
    location_id, bin_id, source_ref, batch_number, unit_cost, label, parent_piece_id, created_by
  ) VALUES (
    v_p.company_id,
    public.next_partial_piece_code_for_item(v_p.company_id, v_p.parent_item_id),
    v_p.parent_item_id, p_second_size, v_p.size_uom,
    v_p.location_id, v_p.bin_id,
    'split-from:' || v_p.piece_code, v_p.batch_number, v_p.unit_cost,
    v_p.label, v_p.id, auth.uid()
  ) RETURNING id INTO v_b;

  RETURN jsonb_build_object('ok', true, 'first_id', v_a, 'second_id', v_b);
END $$;

-- 5. List items that already have partial pieces (for toolbar filter)
CREATE OR REPLACE FUNCTION public.list_partial_piece_items(
  p_company_id uuid,
  p_location_id uuid DEFAULT NULL
)
RETURNS TABLE (parent_item_id uuid, item_code text, item_name text, piece_count bigint)
LANGUAGE sql SECURITY INVOKER STABLE SET search_path = public AS $$
  SELECT i.id, i.item_code, i.name, COUNT(p.id) AS piece_count
    FROM public.warehouse_partial_pieces p
    JOIN public.warehouse_items i ON i.id = p.parent_item_id
   WHERE p.company_id = p_company_id
     AND (p_location_id IS NULL OR p.location_id = p_location_id)
   GROUP BY i.id, i.item_code, i.name
   ORDER BY i.item_code;
$$;
