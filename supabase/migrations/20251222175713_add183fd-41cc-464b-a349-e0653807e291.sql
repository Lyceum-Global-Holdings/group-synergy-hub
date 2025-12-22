-- Create function to process material return stock updates
CREATE OR REPLACE FUNCTION process_material_return_stock_update(
  p_item_id UUID,
  p_quantity_returned NUMERIC,
  p_bin_allocation_id UUID DEFAULT NULL,
  p_mrn_id UUID DEFAULT NULL,
  p_mrn_number TEXT DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_warehouse_item RECORD;
BEGIN
  -- Get current warehouse item with lock
  SELECT * INTO v_warehouse_item
  FROM warehouse_items
  WHERE id = p_item_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Warehouse item not found: %', p_item_id;
  END IF;

  -- Insert stock transaction record (positive quantity = adding stock back)
  INSERT INTO stock_transactions (
    item_id, 
    transaction_type, 
    reference_type, 
    reference_id,
    quantity_change, 
    quantity_before, 
    quantity_after,
    notes, 
    created_by
  ) VALUES (
    p_item_id, 
    'material_return'::stock_transaction_type, 
    'mrn'::stock_reference_type, 
    p_mrn_id,
    p_quantity_returned,
    v_warehouse_item.current_stock,
    v_warehouse_item.current_stock + p_quantity_returned,
    'Material Return via MRN: ' || COALESCE(p_mrn_number, 'Unknown'),
    auth.uid()
  );

  -- Update warehouse item stock (increase)
  UPDATE warehouse_items
  SET current_stock = current_stock + p_quantity_returned,
      updated_at = NOW()
  WHERE id = p_item_id;

  -- Update bin allocation if specified
  IF p_bin_allocation_id IS NOT NULL THEN
    UPDATE warehouse_bin_allocations
    SET allocated_quantity = allocated_quantity + p_quantity_returned,
        available_quantity = available_quantity + p_quantity_returned,
        updated_at = NOW()
    WHERE id = p_bin_allocation_id;
  END IF;
END;
$$;