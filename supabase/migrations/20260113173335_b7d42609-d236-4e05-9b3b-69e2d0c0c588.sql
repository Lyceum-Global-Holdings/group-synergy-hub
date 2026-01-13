-- Fix ambiguous column reference 'current_stock' in update_stock_on_grn_approval function
CREATE OR REPLACE FUNCTION public.update_stock_on_grn_approval()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  -- Only process when status changes to 'approved'
  IF NEW.status = 'approved' AND (OLD.status IS NULL OR OLD.status != 'approved') THEN
    
    -- Insert stock transactions for approved items
    INSERT INTO stock_transactions (
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
      'goods_receipt' as transaction_type,
      'grn' as reference_type,
      NEW.id as reference_id,
      gi.quantity_received as quantity_change,
      COALESCE(wi.current_stock, wi_by_code.current_stock, 0) as quantity_before,
      COALESCE(wi.current_stock, wi_by_code.current_stock, 0) + gi.quantity_received as quantity_after,
      gi.unit_price as unit_cost,
      gi.total_cost as total_value,
      CONCAT('GRN: ', NEW.grn_number, ' - ', gi.item_name) as notes,
      NEW.company_id,
      NEW.approved_by as created_by
    FROM grn_items gi
    LEFT JOIN warehouse_items wi ON gi.warehouse_item_id = wi.id
    LEFT JOIN warehouse_items wi_by_code 
      ON gi.item_code IS NOT NULL 
      AND wi_by_code.item_code = gi.item_code 
      AND (wi_by_code.company_id = NEW.company_id OR wi_by_code.company_id IS NULL)
      AND gi.warehouse_item_id IS NULL
    WHERE gi.grn_id = NEW.id 
      AND gi.quality_status = 'good'
      AND gi.quantity_received > 0
      AND COALESCE(gi.warehouse_item_id, wi_by_code.id) IS NOT NULL;

    -- Update warehouse_items current_stock using a subquery approach to avoid ambiguity
    UPDATE warehouse_items target
    SET current_stock = target.current_stock + updates.quantity_received,
        updated_at = NOW()
    FROM (
      SELECT 
        COALESCE(gi.warehouse_item_id, wi_by_code.id) as item_id,
        gi.quantity_received
      FROM grn_items gi
      LEFT JOIN warehouse_items wi_by_code 
        ON gi.item_code IS NOT NULL 
        AND wi_by_code.item_code = gi.item_code 
        AND (wi_by_code.company_id = NEW.company_id OR wi_by_code.company_id IS NULL)
        AND gi.warehouse_item_id IS NULL
      WHERE gi.grn_id = NEW.id 
        AND gi.quality_status = 'good'
        AND gi.quantity_received > 0
        AND COALESCE(gi.warehouse_item_id, wi_by_code.id) IS NOT NULL
    ) updates
    WHERE target.id = updates.item_id;

  END IF;
  
  RETURN NEW;
END;
$function$;