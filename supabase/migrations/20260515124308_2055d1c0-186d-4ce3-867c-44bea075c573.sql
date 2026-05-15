
-- Partial index for fast "open holdings" lookups
CREATE INDEX IF NOT EXISTS warehouse_bin_allocations_open_idx
  ON public.warehouse_bin_allocations (company_id, warehouse_item_id, updated_at DESC, id)
  WHERE allocated_quantity > 0;

-- List RPC: one row per open (item, bin) holding
CREATE OR REPLACE FUNCTION public.list_partial_quantities(
  p_company_id uuid,
  p_location_id uuid DEFAULT NULL,
  p_search text DEFAULT NULL,
  p_limit int DEFAULT 200,
  p_offset int DEFAULT 0
)
RETURNS TABLE (
  allocation_id uuid,
  item_id uuid,
  item_code text,
  item_name text,
  base_uom text,
  secondary_uom text,
  track_secondary_quantity boolean,
  is_batch_tracked boolean,
  location_id uuid,
  location_name text,
  bin_id uuid,
  bin_code text,
  allocated_quantity numeric,
  reserved_quantity numeric,
  available_quantity numeric,
  secondary_quantity numeric,
  unit_cost numeric,
  total_value numeric,
  fifo_rank int,
  updated_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  WITH base AS (
    SELECT
      a.id            AS allocation_id,
      i.id            AS item_id,
      i.item_code,
      i.name          AS item_name,
      i.base_uom,
      i.secondary_uom,
      COALESCE(i.track_secondary_quantity, false) AS track_secondary_quantity,
      COALESCE(i.is_batch_tracked, false)         AS is_batch_tracked,
      l.id            AS location_id,
      l.name          AS location_name,
      b.id            AS bin_id,
      b.bin_code,
      a.allocated_quantity,
      COALESCE(a.reserved_quantity, 0) AS reserved_quantity,
      COALESCE(a.available_quantity, a.allocated_quantity - COALESCE(a.reserved_quantity, 0)) AS available_quantity,
      a.secondary_quantity,
      i.unit_cost,
      COALESCE(i.unit_cost, 0) * a.allocated_quantity AS total_value,
      ROW_NUMBER() OVER (PARTITION BY i.id ORDER BY a.created_at ASC, a.id) AS fifo_rank,
      a.updated_at
    FROM public.warehouse_bin_allocations a
    JOIN public.warehouse_items     i ON i.id = a.warehouse_item_id
    JOIN public.warehouse_bins      b ON b.id = a.bin_id
    LEFT JOIN public.warehouse_locations l ON l.id = b.location_id
    WHERE a.company_id = p_company_id
      AND a.allocated_quantity > 0
      AND (p_location_id IS NULL OR b.location_id = p_location_id)
      AND public.can_access_company(a.company_id)
      AND (
        p_search IS NULL OR p_search = ''
        OR i.item_code ILIKE '%' || p_search || '%'
        OR i.name      ILIKE '%' || p_search || '%'
        OR b.bin_code  ILIKE '%' || p_search || '%'
      )
  )
  SELECT *
  FROM base
  ORDER BY item_code ASC, fifo_rank ASC, allocation_id
  LIMIT GREATEST(LEAST(p_limit, 1000), 1)
  OFFSET GREATEST(p_offset, 0);
$$;

-- Issue RPC: atomically deduct from one bin holding + write ledger row
CREATE OR REPLACE FUNCTION public.issue_partial_quantity(
  p_allocation_id uuid,
  p_quantity numeric,
  p_secondary_quantity numeric DEFAULT NULL,
  p_reason_code text DEFAULT 'consumption',
  p_reference text DEFAULT NULL,
  p_notes text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_user      uuid := auth.uid();
  v_alloc     record;
  v_new_qty   numeric;
  v_new_sec   numeric;
  v_tx_id     uuid;
  v_allowed   text[] := ARRAY['consumption','internal_transfer','sample','waste','return_to_vendor','correction'];
  v_note_text text;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'authentication_required' USING ERRCODE = '28000';
  END IF;

  IF p_quantity IS NULL OR p_quantity <= 0 THEN
    RAISE EXCEPTION 'invalid_quantity' USING ERRCODE = '22023';
  END IF;

  IF p_reason_code IS NULL OR NOT (p_reason_code = ANY(v_allowed)) THEN
    RAISE EXCEPTION 'invalid_reason_code' USING ERRCODE = '22023';
  END IF;

  SELECT a.id, a.warehouse_item_id, a.bin_id, a.allocated_quantity,
         a.secondary_quantity, a.company_id, b.location_id
    INTO v_alloc
  FROM public.warehouse_bin_allocations a
  JOIN public.warehouse_bins b ON b.id = a.bin_id
  WHERE a.id = p_allocation_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'allocation_not_found' USING ERRCODE = 'P0002';
  END IF;

  IF NOT public.can_access_company(v_alloc.company_id) THEN
    RAISE EXCEPTION 'permission_denied' USING ERRCODE = '42501';
  END IF;

  IF p_quantity > COALESCE(v_alloc.allocated_quantity, 0) THEN
    RAISE EXCEPTION 'insufficient_quantity' USING ERRCODE = '23514';
  END IF;

  v_new_qty := v_alloc.allocated_quantity - p_quantity;
  v_new_sec := CASE
    WHEN p_secondary_quantity IS NULL THEN v_alloc.secondary_quantity
    ELSE COALESCE(v_alloc.secondary_quantity, 0) - p_secondary_quantity
  END;

  UPDATE public.warehouse_bin_allocations
     SET allocated_quantity = v_new_qty,
         secondary_quantity = v_new_sec,
         updated_at         = now()
   WHERE id = p_allocation_id;

  v_note_text := '[partial-issue] ' || p_reason_code
              || COALESCE(' / ref:' || NULLIF(trim(p_reference), ''), '')
              || COALESCE(' / ' || NULLIF(trim(p_notes), ''), '');

  INSERT INTO public.stock_transactions(
    item_id, transaction_type, reference_type, quantity_change,
    quantity_before, quantity_after,
    secondary_quantity_change,
    notes, company_id, created_by,
    bin_id, location_id, adjustment_reason
  ) VALUES (
    v_alloc.warehouse_item_id,
    'issue',
    'issue',
    -p_quantity,
    COALESCE(v_alloc.allocated_quantity, 0),
    v_new_qty,
    CASE WHEN p_secondary_quantity IS NULL THEN NULL ELSE -p_secondary_quantity END,
    v_note_text,
    v_alloc.company_id,
    v_user,
    v_alloc.bin_id,
    v_alloc.location_id,
    p_reason_code
  )
  RETURNING id INTO v_tx_id;

  RETURN jsonb_build_object(
    'ok', true,
    'transaction_id', v_tx_id,
    'remaining_quantity', v_new_qty
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.list_partial_quantities(uuid, uuid, text, int, int) TO authenticated;
GRANT EXECUTE ON FUNCTION public.issue_partial_quantity(uuid, numeric, numeric, text, text, text) TO authenticated;
