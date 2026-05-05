CREATE OR REPLACE FUNCTION public.process_material_issue_stock_update(
  p_item_id uuid,
  p_quantity_issued numeric,
  p_location_id uuid,
  p_bin_allocation_id uuid DEFAULT NULL,
  p_min_id uuid DEFAULT NULL,
  p_min_number text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_item RECORD;
  v_alloc RECORD;
  v_available numeric := 0;
  v_remaining numeric := p_quantity_issued;
  v_take numeric;
  v_before numeric;
  v_company_id uuid;
  v_bin_id uuid;
BEGIN
  IF p_location_id IS NULL THEN
    RAISE EXCEPTION 'Location is required for material issue (SAP MM Goods Issue must specify storage location)';
  END IF;

  IF p_quantity_issued IS NULL OR p_quantity_issued <= 0 THEN
    RAISE EXCEPTION 'Quantity issued must be positive';
  END IF;

  -- Resolve company_id from MIN for audit trail
  IF p_min_id IS NOT NULL THEN
    SELECT company_id INTO v_company_id FROM material_issue_notes WHERE id = p_min_id;
  END IF;

  -- Lock the warehouse item
  SELECT * INTO v_item FROM warehouse_items WHERE id = p_item_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Warehouse item not found: %', p_item_id;
  END IF;

  -- Aggregate available stock at the chosen location only
  SELECT COALESCE(SUM(GREATEST(0, wba.allocated_quantity - COALESCE(wba.reserved_quantity, 0))), 0)
    INTO v_available
  FROM warehouse_bin_allocations wba
  JOIN warehouse_bins wb ON wb.id = wba.bin_id
  WHERE wba.warehouse_item_id = p_item_id
    AND wb.location_id = p_location_id;

  IF v_available < p_quantity_issued THEN
    RAISE EXCEPTION 'Insufficient stock at selected location. Available: %, Requested: %',
      v_available, p_quantity_issued;
  END IF;

  IF p_bin_allocation_id IS NOT NULL THEN
    PERFORM 1
    FROM warehouse_bin_allocations wba
    JOIN warehouse_bins wb ON wb.id = wba.bin_id
    WHERE wba.id = p_bin_allocation_id
      AND wba.warehouse_item_id = p_item_id
      AND wb.location_id = p_location_id;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Selected bin does not belong to the issue location';
    END IF;
  END IF;

  -- FIFO consumption across bins at the location
  FOR v_alloc IN
    SELECT wba.id, wba.bin_id, wba.allocated_quantity, COALESCE(wba.reserved_quantity, 0) AS reserved_quantity
    FROM warehouse_bin_allocations wba
    JOIN warehouse_bins wb ON wb.id = wba.bin_id
    WHERE wba.warehouse_item_id = p_item_id
      AND wb.location_id = p_location_id
      AND (p_bin_allocation_id IS NULL OR wba.id = p_bin_allocation_id)
      AND wba.allocated_quantity > 0
    ORDER BY
      CASE WHEN p_bin_allocation_id IS NOT NULL AND wba.id = p_bin_allocation_id THEN 0 ELSE 1 END,
      wba.created_at ASC
    FOR UPDATE
  LOOP
    EXIT WHEN v_remaining <= 0;

    v_take := LEAST(v_alloc.allocated_quantity, v_remaining);
    IF v_take <= 0 THEN
      CONTINUE;
    END IF;

    v_before := v_alloc.allocated_quantity;
    v_bin_id := v_alloc.bin_id;

    -- Legacy per-bin movement log (kept for backward compatibility)
    INSERT INTO warehouse_stock_movements (
      warehouse_item_id, bin_allocation_id, movement_type,
      reference_type, reference_id, reference_number,
      quantity_change, quantity_before, quantity_after,
      notes, created_by, created_at
    ) VALUES (
      p_item_id, v_alloc.id, 'issue',
      'material_issue', p_min_id, p_min_number,
      -v_take, v_before, v_before - v_take,
      'Material issued via MIN: ' || COALESCE(p_min_number, 'Unknown'),
      auth.uid(), NOW()
    );

    -- Canonical stock_transactions audit row (per-bin granularity, SAP MM 261-equivalent)
    INSERT INTO stock_transactions (
      item_id, location_id, bin_id,
      transaction_type, reference_type, reference_id,
      quantity_change, quantity_before, quantity_after,
      notes, company_id, created_by
    ) VALUES (
      p_item_id, p_location_id, v_bin_id,
      'material_issue', 'manual', p_min_id,
      -v_take, v_before, v_before - v_take,
      'Material Issue: ' || COALESCE(p_min_number, p_min_id::text, 'MIN'),
      v_company_id, auth.uid()
    );

    -- Update bin allocation. NEVER touch generated column available_quantity.
    UPDATE warehouse_bin_allocations
    SET
      allocated_quantity = GREATEST(0, allocated_quantity - v_take),
      reserved_quantity  = GREATEST(0, COALESCE(reserved_quantity, 0) - LEAST(v_take, COALESCE(reserved_quantity, 0))),
      updated_at = NOW()
    WHERE id = v_alloc.id;

    v_remaining := v_remaining - v_take;
  END LOOP;

  IF v_remaining > 0 THEN
    RAISE EXCEPTION 'Could not allocate full quantity at location. Short by %', v_remaining;
  END IF;

  -- Reduce reserved_quantity on warehouse_items (best-effort — never go negative)
  UPDATE warehouse_items
  SET reserved_quantity = GREATEST(0, COALESCE(reserved_quantity, 0) - p_quantity_issued),
      updated_at = NOW()
  WHERE id = p_item_id;
END;
$function$;