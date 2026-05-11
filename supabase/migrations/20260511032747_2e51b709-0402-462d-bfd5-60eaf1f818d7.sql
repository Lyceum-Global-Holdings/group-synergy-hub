
CREATE OR REPLACE FUNCTION public.adjust_bin_allocation_from_scan(
  p_allocation_id uuid,
  p_delta numeric,
  p_reason_code text,
  p_notes text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_alloc      record;
  v_user       uuid := auth.uid();
  v_new_qty    numeric;
  v_tx_id      uuid;
  v_allowed    text[] := ARRAY['cycle_count','damage','loss','found','correction','transfer_in','transfer_out'];
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'authentication_required' USING ERRCODE = '28000';
  END IF;

  IF p_delta IS NULL OR p_delta = 0 THEN
    RAISE EXCEPTION 'invalid_delta' USING ERRCODE = '22023';
  END IF;

  IF p_reason_code IS NULL OR NOT (p_reason_code = ANY(v_allowed)) THEN
    RAISE EXCEPTION 'invalid_reason_code' USING ERRCODE = '22023';
  END IF;

  SELECT a.id, a.warehouse_item_id, a.bin_id, a.allocated_quantity, a.company_id,
         b.location_id, i.current_stock
    INTO v_alloc
  FROM public.warehouse_bin_allocations a
  JOIN public.warehouse_bins b  ON b.id = a.bin_id
  JOIN public.warehouse_items i ON i.id = a.warehouse_item_id
  WHERE a.id = p_allocation_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'allocation_not_found' USING ERRCODE = 'P0002';
  END IF;

  IF NOT public.can_access_company(v_alloc.company_id) THEN
    RAISE EXCEPTION 'permission_denied' USING ERRCODE = '42501';
  END IF;

  v_new_qty := COALESCE(v_alloc.allocated_quantity, 0) + p_delta;
  IF v_new_qty < 0 THEN
    RAISE EXCEPTION 'insufficient_quantity' USING ERRCODE = '23514';
  END IF;

  UPDATE public.warehouse_bin_allocations
     SET allocated_quantity = v_new_qty,
         updated_at         = now()
   WHERE id = p_allocation_id;

  INSERT INTO public.stock_transactions(
    item_id, transaction_type, reference_type, quantity_change,
    quantity_before, quantity_after, notes, company_id, created_by,
    bin_id, location_id, adjustment_reason
  ) VALUES (
    v_alloc.warehouse_item_id,
    'adjustment',
    'adjustment',
    p_delta,
    COALESCE(v_alloc.current_stock, 0),
    COALESCE(v_alloc.current_stock, 0) + p_delta,
    '[QR scan] ' || COALESCE(NULLIF(trim(p_notes), ''), p_reason_code),
    v_alloc.company_id,
    v_user,
    v_alloc.bin_id,
    v_alloc.location_id,
    p_reason_code
  )
  RETURNING id INTO v_tx_id;

  RETURN jsonb_build_object(
    'ok', true,
    'new_quantity', v_new_qty,
    'transaction_id', v_tx_id
  );
END;
$$;

REVOKE ALL ON FUNCTION public.adjust_bin_allocation_from_scan(uuid, numeric, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.adjust_bin_allocation_from_scan(uuid, numeric, text, text) TO authenticated;
