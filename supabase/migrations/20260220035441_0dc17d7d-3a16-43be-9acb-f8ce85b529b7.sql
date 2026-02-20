
CREATE OR REPLACE FUNCTION public.process_material_issue_stock_update(
  p_item_id uuid,
  p_quantity_issued numeric,
  p_bin_allocation_id uuid DEFAULT NULL,
  p_min_id uuid DEFAULT NULL,
  p_min_number text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_warehouse_item RECORD;
  v_bin_allocation RECORD;
  v_resolved_bin_alloc_id uuid;
  v_available_stock numeric;
  v_has_bins boolean;
BEGIN
  -- 1. Lock and get the warehouse item
  SELECT * INTO v_warehouse_item
  FROM warehouse_items WHERE id = p_item_id FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Warehouse item not found: %', p_item_id;
  END IF;

  -- 2. Check if item has any bin allocations
  SELECT EXISTS(
    SELECT 1 FROM warehouse_bin_allocations WHERE warehouse_item_id = p_item_id
  ) INTO v_has_bins;

  -- 3. Determine effective stock and bin allocation to use
  IF v_has_bins THEN
    -- Use bin total as the source of truth
    SELECT COALESCE(SUM(allocated_quantity), 0) INTO v_available_stock
    FROM warehouse_bin_allocations WHERE warehouse_item_id = p_item_id;
    
    -- Resolve which bin to deduct from
    v_resolved_bin_alloc_id := p_bin_allocation_id;
    IF v_resolved_bin_alloc_id IS NULL THEN
      -- Pick the bin with the most available quantity for this item
      SELECT id INTO v_resolved_bin_alloc_id
      FROM warehouse_bin_allocations
      WHERE warehouse_item_id = p_item_id
        AND allocated_quantity >= p_quantity_issued
      ORDER BY allocated_quantity DESC
      LIMIT 1;
      
      -- Fallback: pick any bin even if not enough (will use GREATEST(0,...))
      IF v_resolved_bin_alloc_id IS NULL THEN
        SELECT id INTO v_resolved_bin_alloc_id
        FROM warehouse_bin_allocations
        WHERE warehouse_item_id = p_item_id
        ORDER BY allocated_quantity DESC
        LIMIT 1;
      END IF;
    END IF;
  ELSE
    -- No bins: use warehouse_items.current_stock directly
    v_available_stock := v_warehouse_item.current_stock;
    v_resolved_bin_alloc_id := NULL;
  END IF;

  -- 4. Stock check — prevent issuing more than available
  IF v_available_stock < p_quantity_issued THEN
    RAISE EXCEPTION 'Insufficient stock. Available: %, Requested: %',
      v_available_stock, p_quantity_issued;
  END IF;

  -- 5. Record stock movement
  INSERT INTO warehouse_stock_movements (
    warehouse_item_id, bin_allocation_id, movement_type,
    reference_type, reference_id, reference_number,
    quantity_change, quantity_before, quantity_after,
    notes, created_by, created_at
  ) VALUES (
    p_item_id, v_resolved_bin_alloc_id, 'issue',
    'material_issue', p_min_id, p_min_number,
    -p_quantity_issued, v_available_stock, v_available_stock - p_quantity_issued,
    'Material issued via MIN: ' || COALESCE(p_min_number, 'Unknown'),
    auth.uid(), NOW()
  );

  -- 6. Update stock through the correct path
  IF v_resolved_bin_alloc_id IS NOT NULL THEN
    -- Update bin allocation only; the trg_sync_item_stock_after_bin_allocation
    -- trigger will automatically sync warehouse_items.current_stock = SUM(bins)
    UPDATE warehouse_bin_allocations
    SET
      allocated_quantity = GREATEST(0, allocated_quantity - p_quantity_issued),
      reserved_quantity  = GREATEST(0, reserved_quantity - p_quantity_issued),
      available_quantity = GREATEST(0, (allocated_quantity - p_quantity_issued) - GREATEST(0, reserved_quantity - p_quantity_issued)),
      updated_at = NOW()
    WHERE id = v_resolved_bin_alloc_id;
  ELSE
    -- No bins exist: update warehouse_items directly
    UPDATE warehouse_items
    SET
      current_stock = GREATEST(0, current_stock - p_quantity_issued),
      updated_at = NOW()
    WHERE id = p_item_id;
  END IF;

  -- 7. Reduce reserved_quantity on warehouse_items regardless of path
  UPDATE warehouse_items
  SET
    reserved_quantity = GREATEST(0, reserved_quantity - p_quantity_issued),
    updated_at = NOW()
  WHERE id = p_item_id;

END;
$$;
