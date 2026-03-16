CREATE OR REPLACE FUNCTION public.remove_item_from_inventory(p_item_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT (has_warehouse_access(auth.uid()) OR is_admin(auth.uid())) THEN
    RAISE EXCEPTION 'Access denied: insufficient permissions';
  END IF;

  DELETE FROM warehouse_bin_allocations WHERE warehouse_item_id = p_item_id;
  DELETE FROM stock_transactions WHERE item_id = p_item_id;
  UPDATE warehouse_items SET current_stock = 0 WHERE id = p_item_id;
END;
$$;