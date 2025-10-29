-- Fix security warning: Set search_path for the sync function
CREATE OR REPLACE FUNCTION sync_item_stock_from_bins()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_item_id uuid;
  v_total_allocated numeric;
BEGIN
  -- Get the item_id from the affected row
  IF TG_OP = 'DELETE' THEN
    v_item_id := OLD.warehouse_item_id;
  ELSE
    v_item_id := NEW.warehouse_item_id;
  END IF;

  -- Calculate total allocated quantity for this item
  SELECT COALESCE(SUM(allocated_quantity), 0)
  INTO v_total_allocated
  FROM warehouse_bin_allocations
  WHERE warehouse_item_id = v_item_id;

  -- Update the item's current_stock
  UPDATE warehouse_items
  SET 
    current_stock = v_total_allocated,
    updated_at = NOW()
  WHERE id = v_item_id;

  -- Return the appropriate row
  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  ELSE
    RETURN NEW;
  END IF;
END;
$$;