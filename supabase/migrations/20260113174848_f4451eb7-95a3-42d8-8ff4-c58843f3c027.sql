CREATE OR REPLACE FUNCTION public.update_stock_on_grn_approval()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  po_fully_received BOOLEAN;
  po_any_received BOOLEAN;
  v_po_id UUID;
BEGIN
  -- Only process when status changes to 'approved'
  IF NEW.status = 'approved' AND (OLD.status IS NULL OR OLD.status != 'approved') THEN
    
    -- Store the PO ID for later status update
    v_po_id := NEW.po_id;
    
    -- 1. Insert stock transactions for approved items
    INSERT INTO stock_transactions (
      item_id, transaction_type, reference_type, reference_id,
      quantity_change, quantity_before, quantity_after,
      unit_cost, total_value, notes, company_id, created_by
    )
    SELECT 
      COALESCE(gi.warehouse_item_id, wi_by_code.id) as item_id,
      'goods_receipt', 'grn', NEW.id,
      gi.quantity_received,
      COALESCE(wi.current_stock, wi_by_code.current_stock, 0),
      COALESCE(wi.current_stock, wi_by_code.current_stock, 0) + gi.quantity_received,
      gi.unit_price, gi.total_cost,
      CONCAT('GRN: ', NEW.grn_number, ' - ', gi.item_name),
      NEW.company_id, NEW.approved_by
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

    -- 2. Update warehouse_items current_stock
    UPDATE warehouse_items target
    SET current_stock = target.current_stock + updates.total_qty,
        updated_at = NOW()
    FROM (
      SELECT COALESCE(gi.warehouse_item_id, wi_by_code.id) as item_id, 
             SUM(gi.quantity_received) as total_qty
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
      GROUP BY COALESCE(gi.warehouse_item_id, wi_by_code.id)
    ) updates
    WHERE target.id = updates.item_id;

    -- 3. Update po_items.quantity_received for items with po_item_id
    UPDATE po_items
    SET quantity_received = COALESCE(po_items.quantity_received, 0) + gi.quantity_received,
        updated_at = NOW()
    FROM grn_items gi
    WHERE gi.grn_id = NEW.id
      AND gi.po_item_id IS NOT NULL
      AND po_items.id = gi.po_item_id
      AND gi.quality_status = 'good'
      AND gi.quantity_received > 0;

    -- 4. Update purchase_orders status based on receipt completion
    IF v_po_id IS NOT NULL THEN
      -- Check if all items are fully received
      SELECT 
        BOOL_AND(COALESCE(quantity_received, 0) >= quantity),
        BOOL_OR(COALESCE(quantity_received, 0) > 0)
      INTO po_fully_received, po_any_received
      FROM po_items
      WHERE po_id = v_po_id;
      
      -- Update PO status accordingly
      IF po_fully_received THEN
        UPDATE purchase_orders 
        SET status = 'completed', updated_at = NOW()
        WHERE id = v_po_id;
      ELSIF po_any_received THEN
        UPDATE purchase_orders 
        SET status = 'partially_received', updated_at = NOW()
        WHERE id = v_po_id
        AND status NOT IN ('completed', 'cancelled');
      END IF;
    END IF;

  END IF;
  
  RETURN NEW;
END;
$function$;