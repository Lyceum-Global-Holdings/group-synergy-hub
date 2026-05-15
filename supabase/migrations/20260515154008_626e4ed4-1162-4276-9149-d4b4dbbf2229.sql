
-- Drop old inventory-mixed RPCs
DROP FUNCTION IF EXISTS public.list_partial_quantities(uuid, uuid, text, integer, integer);
DROP FUNCTION IF EXISTS public.issue_partial_quantity(uuid, numeric, numeric, text, text, text);
DROP FUNCTION IF EXISTS public.import_partial_quantities(uuid, jsonb, boolean);

-- Status enum
DO $$ BEGIN
  CREATE TYPE public.partial_piece_status AS ENUM ('available','reserved','consumed','scrapped');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Table
CREATE TABLE IF NOT EXISTS public.warehouse_partial_pieces (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL,
  piece_code text NOT NULL,
  parent_item_id uuid NOT NULL REFERENCES public.warehouse_items(id) ON DELETE RESTRICT,
  size_value numeric(14,4) NOT NULL CHECK (size_value > 0),
  size_uom text NOT NULL,
  location_id uuid NOT NULL REFERENCES public.warehouse_locations(id) ON DELETE RESTRICT,
  bin_id uuid REFERENCES public.warehouse_bins(id) ON DELETE SET NULL,
  status public.partial_piece_status NOT NULL DEFAULT 'available',
  source_ref text,
  batch_number text,
  unit_cost numeric(14,4),
  label text,
  notes text,
  consumed_at timestamptz,
  consumed_by uuid,
  consumed_qty numeric(14,4),
  consumed_reason text,
  parent_piece_id uuid REFERENCES public.warehouse_partial_pieces(id) ON DELETE SET NULL,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT warehouse_partial_pieces_code_uq UNIQUE (company_id, piece_code)
);

CREATE INDEX IF NOT EXISTS warehouse_partial_pieces_company_created_idx
  ON public.warehouse_partial_pieces (company_id, created_at DESC);
CREATE INDEX IF NOT EXISTS warehouse_partial_pieces_available_idx
  ON public.warehouse_partial_pieces (company_id, parent_item_id) WHERE status = 'available';
CREATE INDEX IF NOT EXISTS warehouse_partial_pieces_loc_status_idx
  ON public.warehouse_partial_pieces (company_id, location_id, status);

-- updated_at trigger
CREATE TRIGGER warehouse_partial_pieces_set_updated_at
  BEFORE UPDATE ON public.warehouse_partial_pieces
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- RLS
ALTER TABLE public.warehouse_partial_pieces ENABLE ROW LEVEL SECURITY;

CREATE POLICY "partial_pieces_select" ON public.warehouse_partial_pieces
  FOR SELECT TO authenticated
  USING (public.can_access_company(company_id));

CREATE POLICY "partial_pieces_insert" ON public.warehouse_partial_pieces
  FOR INSERT TO authenticated
  WITH CHECK (public.can_access_company(company_id));

CREATE POLICY "partial_pieces_update" ON public.warehouse_partial_pieces
  FOR UPDATE TO authenticated
  USING (public.can_access_company(company_id))
  WITH CHECK (public.can_access_company(company_id));

CREATE POLICY "partial_pieces_delete" ON public.warehouse_partial_pieces
  FOR DELETE TO authenticated
  USING (public.can_access_company(company_id));

-- Auto piece_code generator
CREATE OR REPLACE FUNCTION public.next_partial_piece_code(p_company_id uuid)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_today text := to_char(now(), 'YYYYMMDD');
  v_seq int;
BEGIN
  SELECT COALESCE(MAX(NULLIF(regexp_replace(piece_code, '^PQ-' || v_today || '-', ''), '')::int), 0) + 1
    INTO v_seq
    FROM public.warehouse_partial_pieces
   WHERE company_id = p_company_id
     AND piece_code LIKE 'PQ-' || v_today || '-%';
  RETURN 'PQ-' || v_today || '-' || lpad(v_seq::text, 4, '0');
END $$;

-- LIST
CREATE OR REPLACE FUNCTION public.list_partial_pieces(
  p_company_id uuid,
  p_location_id uuid DEFAULT NULL,
  p_parent_item_id uuid DEFAULT NULL,
  p_status text DEFAULT NULL,
  p_search text DEFAULT NULL,
  p_limit int DEFAULT 500,
  p_offset int DEFAULT 0
)
RETURNS TABLE (
  id uuid,
  piece_code text,
  parent_item_id uuid,
  parent_item_code text,
  parent_item_name text,
  base_uom text,
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
  age_days int,
  created_at timestamptz,
  updated_at timestamptz
)
LANGUAGE sql SECURITY INVOKER STABLE SET search_path = public AS $$
  SELECT
    p.id, p.piece_code, p.parent_item_id, i.item_code, i.name, i.base_uom,
    p.size_value, p.size_uom,
    p.location_id, l.location_code, p.bin_id, b.bin_code,
    p.status::text, p.source_ref, p.batch_number, p.unit_cost, p.label, p.notes,
    GREATEST(0, EXTRACT(DAY FROM (now() - p.created_at))::int) AS age_days,
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

-- CREATE
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
  IF v_code IS NULL THEN v_code := public.next_partial_piece_code(v_company); END IF;

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

-- UPDATE
CREATE OR REPLACE FUNCTION public.update_partial_piece(p_id uuid, p_payload jsonb)
RETURNS void LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
DECLARE v_status public.partial_piece_status;
BEGIN
  SELECT status INTO v_status FROM public.warehouse_partial_pieces WHERE id = p_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'piece not found'; END IF;
  IF v_status NOT IN ('available','reserved') THEN
    RAISE EXCEPTION 'cannot edit a % piece', v_status;
  END IF;

  UPDATE public.warehouse_partial_pieces SET
    size_value    = COALESCE(NULLIF(p_payload->>'size_value','')::numeric, size_value),
    size_uom      = COALESCE(NULLIF(p_payload->>'size_uom',''), size_uom),
    location_id   = COALESCE(NULLIF(p_payload->>'location_id','')::uuid, location_id),
    bin_id        = CASE WHEN p_payload ? 'bin_id' THEN NULLIF(p_payload->>'bin_id','')::uuid ELSE bin_id END,
    source_ref    = CASE WHEN p_payload ? 'source_ref' THEN NULLIF(p_payload->>'source_ref','') ELSE source_ref END,
    batch_number  = CASE WHEN p_payload ? 'batch_number' THEN NULLIF(p_payload->>'batch_number','') ELSE batch_number END,
    unit_cost     = CASE WHEN p_payload ? 'unit_cost' THEN NULLIF(p_payload->>'unit_cost','')::numeric ELSE unit_cost END,
    label         = CASE WHEN p_payload ? 'label' THEN NULLIF(p_payload->>'label','') ELSE label END,
    notes         = CASE WHEN p_payload ? 'notes' THEN NULLIF(p_payload->>'notes','') ELSE notes END,
    status        = COALESCE((NULLIF(p_payload->>'status',''))::public.partial_piece_status, status)
  WHERE id = p_id;
END $$;

-- DELETE
CREATE OR REPLACE FUNCTION public.delete_partial_piece(p_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
DECLARE v_status public.partial_piece_status;
BEGIN
  SELECT status INTO v_status FROM public.warehouse_partial_pieces WHERE id = p_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'piece not found'; END IF;
  IF v_status NOT IN ('available','reserved') THEN
    RAISE EXCEPTION 'cannot delete a % piece', v_status;
  END IF;
  DELETE FROM public.warehouse_partial_pieces WHERE id = p_id;
END $$;

-- CONSUME
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

  -- Mark original consumed/scrapped
  UPDATE public.warehouse_partial_pieces
     SET status = v_new_status,
         consumed_at = now(),
         consumed_by = auth.uid(),
         consumed_qty = p_quantity,
         consumed_reason = p_reason,
         notes = COALESCE(notes,'') ||
                 CASE WHEN p_notes IS NOT NULL AND p_notes <> '' THEN E'\n[consume] ' || p_notes ELSE '' END
   WHERE id = p_id;

  -- If partial, create residual remnant
  IF v_residual_size > 0 THEN
    INSERT INTO public.warehouse_partial_pieces(
      company_id, piece_code, parent_item_id, size_value, size_uom,
      location_id, bin_id, source_ref, batch_number, unit_cost, label, parent_piece_id, created_by
    ) VALUES (
      v_p.company_id, public.next_partial_piece_code(v_p.company_id),
      v_p.parent_item_id, v_residual_size, v_p.size_uom,
      v_p.location_id, v_p.bin_id,
      'split-from:' || v_p.piece_code,
      v_p.batch_number, v_p.unit_cost,
      v_p.label, v_p.id, auth.uid()
    ) RETURNING id INTO v_residual_id;
  END IF;

  -- Optionally post to parent stock ledger
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

-- SPLIT
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
    v_p.company_id, public.next_partial_piece_code(v_p.company_id),
    v_p.parent_item_id, p_first_size, v_p.size_uom,
    v_p.location_id, v_p.bin_id,
    'split-from:' || v_p.piece_code, v_p.batch_number, v_p.unit_cost,
    v_p.label, v_p.id, auth.uid()
  ) RETURNING id INTO v_a;

  INSERT INTO public.warehouse_partial_pieces(
    company_id, piece_code, parent_item_id, size_value, size_uom,
    location_id, bin_id, source_ref, batch_number, unit_cost, label, parent_piece_id, created_by
  ) VALUES (
    v_p.company_id, public.next_partial_piece_code(v_p.company_id),
    v_p.parent_item_id, p_second_size, v_p.size_uom,
    v_p.location_id, v_p.bin_id,
    'split-from:' || v_p.piece_code, v_p.batch_number, v_p.unit_cost,
    v_p.label, v_p.id, auth.uid()
  ) RETURNING id INTO v_b;

  RETURN jsonb_build_object('ok', true, 'first_id', v_a, 'second_id', v_b);
END $$;

-- IMPORT
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

      INSERT INTO public.warehouse_partial_pieces(
        company_id, piece_code, parent_item_id, size_value, size_uom,
        location_id, bin_id, source_ref, batch_number, unit_cost, label, notes, created_by
      ) VALUES (
        p_company_id, v_code, v_item_id,
        (v_row->>'size_value')::numeric, v_uom,
        v_loc_id, v_bin_id,
        NULLIF(v_row->>'source_ref',''),
        NULLIF(v_row->>'batch_number',''),
        v_cost,
        NULLIF(v_row->>'label',''),
        NULLIF(v_row->>'notes',''),
        auth.uid()
      );
      v_inserted := v_inserted + 1;
    EXCEPTION WHEN OTHERS THEN
      v_errors := v_errors || jsonb_build_object('row', v_idx, 'error', SQLERRM, 'data', v_row);
    END;
  END LOOP;

  RETURN jsonb_build_object('inserted', v_inserted, 'errors', v_errors);
END $$;
