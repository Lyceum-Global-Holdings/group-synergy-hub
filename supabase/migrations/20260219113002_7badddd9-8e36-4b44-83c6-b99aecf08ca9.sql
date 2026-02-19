CREATE OR REPLACE FUNCTION process_material_return_stock_update(
  p_item_id UUID,
  p_quantity_returned NUMERIC,
  p_bin_allocation_id UUID DEFAULT NULL,
  p_mrn_id UUID DEFAULT NULL,
  p_mrn_number TEXT DEFAULT NULL,
  p_company_id UUID DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_warehouse_item RECORD;
  v_bin_alloc_id UUID;
BEGIN
  SELECT * INTO v_warehouse_item
  FROM warehouse_items WHERE id = p_item_id FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Warehouse item not found: %', p_item_id;
  END IF;

  -- Insert stock transaction
  INSERT INTO stock_transactions (
    item_id, transaction_type, reference_type, reference_id,
    quantity_change, quantity_before, quantity_after,
    notes, created_by
  ) VALUES (
    p_item_id, 'material_return', 'mrn', p_mrn_id,
    p_quantity_returned, v_warehouse_item.current_stock,
    v_warehouse_item.current_stock + p_quantity_returned,
    'Material Return via MRN: ' || COALESCE(p_mrn_number, 'Unknown'),
    auth.uid()
  );

  -- Update warehouse item stock
  UPDATE warehouse_items
  SET current_stock = current_stock + p_quantity_returned, updated_at = NOW()
  WHERE id = p_item_id;

  -- Determine bin allocation ID
  v_bin_alloc_id := p_bin_allocation_id;

  -- If no bin allocation provided, find one scoped to company
  IF v_bin_alloc_id IS NULL AND p_company_id IS NOT NULL THEN
    SELECT id INTO v_bin_alloc_id
    FROM warehouse_bin_allocations
    WHERE warehouse_item_id = p_item_id AND company_id = p_company_id
    LIMIT 1;
  END IF;

  -- Update bin allocation if found
  IF v_bin_alloc_id IS NOT NULL THEN
    UPDATE warehouse_bin_allocations
    SET allocated_quantity = allocated_quantity + p_quantity_returned,
        available_quantity = available_quantity + p_quantity_returned,
        updated_at = NOW()
    WHERE id = v_bin_alloc_id;
  END IF;
END;
$$;