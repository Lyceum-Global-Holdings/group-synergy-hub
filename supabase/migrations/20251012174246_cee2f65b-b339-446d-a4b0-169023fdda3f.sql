-- Fix the update_stock_on_grn_approval trigger to handle item matching by code and set proper created_by
CREATE OR REPLACE FUNCTION public.update_stock_on_grn_approval()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only update stock when status changes from non-approved to approved
  IF NEW.status = 'approved' AND (OLD.status IS NULL OR OLD.status != 'approved') THEN
    -- Insert stock transactions for all GRN items
    INSERT INTO public.stock_transactions (
      item_id,
      transaction_type,
      reference_type,
      reference_id,
      quantity_change,
      quantity_before,
      quantity_after,
      unit_cost,
      total_value,
      notes,
      company_id,
      created_by
    )
    SELECT 
      COALESCE(gi.warehouse_item_id, wi_by_code.id) as item_id,
      'goods_receipt'::stock_transaction_type,
      'grn'::stock_reference_type,
      NEW.id,
      gi.quantity_received,
      COALESCE(wi.current_stock, wi_by_code.current_stock, 0),
      COALESCE(wi.current_stock, wi_by_code.current_stock, 0) + gi.quantity_received,
      gi.unit_price,
      gi.total_cost,
      'GRN: ' || NEW.grn_number || ' - ' || gi.item_name,
      NEW.company_id,
      COALESCE(NEW.approved_by, NEW.created_by)
    FROM grn_items gi
    LEFT JOIN warehouse_items wi ON gi.warehouse_item_id = wi.id
    LEFT JOIN warehouse_items wi_by_code ON gi.item_code IS NOT NULL 
      AND wi_by_code.item_code = gi.item_code 
      AND wi_by_code.company_id = NEW.company_id
    WHERE gi.grn_id = NEW.id 
      AND (gi.warehouse_item_id IS NOT NULL OR wi_by_code.id IS NOT NULL)
      AND gi.quantity_received > 0;
  END IF;
  
  RETURN NEW;
END;
$$;