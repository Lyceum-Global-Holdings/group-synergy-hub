
DROP FUNCTION IF EXISTS public.process_material_issue_stock_update(uuid,numeric,uuid,uuid,uuid,text);
DROP FUNCTION IF EXISTS public.process_material_issue_stock_update(uuid,numeric,uuid,uuid,uuid,text,numeric);

CREATE FUNCTION public.process_material_issue_stock_update(
  p_item_id uuid, p_quantity_issued numeric, p_location_id uuid,
  p_bin_allocation_id uuid, p_min_id uuid, p_min_number text
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_item RECORD; v_alloc RECORD;
  v_available numeric := 0; v_remaining numeric := p_quantity_issued;
  v_take numeric; v_before numeric;
  v_company_id uuid; v_bin_id uuid; v_bin_loc uuid;
BEGIN
  IF p_location_id IS NULL THEN RAISE EXCEPTION 'Location is required for material issue'; END IF;
  IF p_quantity_issued IS NULL OR p_quantity_issued <= 0 THEN RAISE EXCEPTION 'Quantity issued must be positive'; END IF;
  IF p_min_id IS NOT NULL THEN
    SELECT company_id INTO v_company_id FROM material_issue_notes WHERE id = p_min_id;
  END IF;

  SELECT * INTO v_item FROM warehouse_items WHERE id = p_item_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Warehouse item not found: %', p_item_id; END IF;

  WITH RECURSIVE loc_tree AS (
    SELECT id FROM warehouse_locations WHERE id = p_location_id
    UNION ALL SELECT wl.id FROM warehouse_locations wl JOIN loc_tree t ON wl.parent_id = t.id
  )
  SELECT COALESCE(SUM(GREATEST(0, wba.allocated_quantity - COALESCE(wba.reserved_quantity,0))),0)
    INTO v_available
  FROM warehouse_bin_allocations wba JOIN warehouse_bins wb ON wb.id = wba.bin_id
  WHERE wba.warehouse_item_id = p_item_id AND wb.location_id IN (SELECT id FROM loc_tree);

  IF v_available < p_quantity_issued THEN
    RAISE EXCEPTION 'Insufficient stock at selected location (incl. sub-locations). Available: %, Requested: %', v_available, p_quantity_issued;
  END IF;

  FOR v_alloc IN
    WITH RECURSIVE loc_tree AS (
      SELECT id FROM warehouse_locations WHERE id = p_location_id
      UNION ALL SELECT wl.id FROM warehouse_locations wl JOIN loc_tree t ON wl.parent_id = t.id
    )
    SELECT wba.id, wba.bin_id, wba.allocated_quantity, wb.location_id AS bin_location_id
    FROM warehouse_bin_allocations wba JOIN warehouse_bins wb ON wb.id = wba.bin_id
    WHERE wba.warehouse_item_id = p_item_id
      AND wb.location_id IN (SELECT id FROM loc_tree)
      AND (p_bin_allocation_id IS NULL OR wba.id = p_bin_allocation_id)
      AND wba.allocated_quantity > 0
    ORDER BY CASE WHEN p_bin_allocation_id IS NOT NULL AND wba.id = p_bin_allocation_id THEN 0 ELSE 1 END, wba.created_at ASC
    FOR UPDATE OF wba
  LOOP
    EXIT WHEN v_remaining <= 0;
    v_take := LEAST(v_alloc.allocated_quantity, v_remaining);
    IF v_take <= 0 THEN CONTINUE; END IF;
    v_before := v_alloc.allocated_quantity;
    v_bin_id := v_alloc.bin_id; v_bin_loc := v_alloc.bin_location_id;

    INSERT INTO warehouse_stock_movements (
      warehouse_item_id, bin_allocation_id, movement_type,
      reference_type, reference_id, reference_number,
      quantity_change, quantity_before, quantity_after, notes, created_by, created_at
    ) VALUES (
      p_item_id, v_alloc.id, 'issue', 'material_issue', p_min_id, p_min_number,
      -v_take, v_before, v_before - v_take,
      'Material issued via MIN: ' || COALESCE(p_min_number, 'Unknown'), auth.uid(), NOW()
    );

    INSERT INTO stock_transactions (
      item_id, location_id, bin_id, transaction_type, reference_type, reference_id,
      quantity_change, notes, company_id, created_by
    ) VALUES (
      p_item_id, v_bin_loc, v_bin_id, 'material_issue', 'mrn', p_min_id,
      -v_take, 'Material Issue: ' || COALESCE(p_min_number, p_min_id::text, 'MIN'),
      v_company_id, auth.uid()
    );

    UPDATE warehouse_bin_allocations SET allocated_quantity = GREATEST(0, allocated_quantity - v_take), updated_at = NOW() WHERE id = v_alloc.id;
    v_remaining := v_remaining - v_take;
  END LOOP;

  UPDATE warehouse_items SET current_stock = GREATEST(0, COALESCE(current_stock,0) - p_quantity_issued), updated_at = NOW() WHERE id = p_item_id;
END;
$$;

CREATE FUNCTION public.process_material_issue_stock_update(
  p_item_id uuid, p_quantity_issued numeric, p_location_id uuid,
  p_bin_allocation_id uuid, p_min_id uuid, p_min_number text, p_secondary_quantity_issued numeric
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public.process_material_issue_stock_update(p_item_id, p_quantity_issued, p_location_id, p_bin_allocation_id, p_min_id, p_min_number);
END;
$$;

UPDATE stock_transactions
SET reference_type = 'mrn'
WHERE transaction_type = 'material_issue'
  AND reference_type = 'manual'
  AND reference_id IN (SELECT id FROM material_issue_notes);

CREATE INDEX IF NOT EXISTS idx_stock_transactions_reference
  ON stock_transactions (reference_type, reference_id);
