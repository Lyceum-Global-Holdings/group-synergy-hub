-- Fix update_po_quantities_on_grn_approval to qualify columns properly
CREATE OR REPLACE FUNCTION public.update_po_quantities_on_grn_approval()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only execute when GRN status changes to 'approved'
  IF NEW.status = 'approved' AND (OLD.status IS NULL OR OLD.status != 'approved') THEN
    
    -- Update PO item quantities from GRN items (only "good" quality items)
    UPDATE po_items poi
    SET 
      quantity_received = poi.quantity_received + gi.quantity_received,
      quantity_pending = poi.quantity_ordered - (poi.quantity_received + gi.quantity_received),
      updated_at = now()
    FROM grn_items gi
    WHERE gi.grn_id = NEW.id 
      AND gi.po_item_id = poi.id
      AND gi.quality_status = 'good';
    
    -- Update PO status based on receipt progress
    UPDATE purchase_orders
    SET 
      status = CASE
        WHEN (SELECT COALESCE(SUM(quantity_pending), 0) FROM po_items WHERE po_id = NEW.po_id) = 0 
          THEN 'completed'
        WHEN (SELECT COALESCE(SUM(quantity_received), 0) FROM po_items WHERE po_id = NEW.po_id) > 0 
          THEN 'partially_received'
        ELSE status
      END,
      updated_at = now()
    WHERE id = NEW.po_id;
    
  END IF;
  
  RETURN NEW;
END;
$$;

-- Update update_stock_on_grn_approval to only post "good" quality items
CREATE OR REPLACE FUNCTION public.update_stock_on_grn_approval()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'approved' AND (OLD.status IS NULL OR OLD.status != 'approved') THEN
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
    LEFT JOIN warehouse_items wi_by_code 
      ON gi.item_code IS NOT NULL 
      AND wi_by_code.item_code = gi.item_code 
      AND wi_by_code.company_id = NEW.company_id
    WHERE gi.grn_id = NEW.id 
      AND gi.quality_status = 'good'
      AND (gi.warehouse_item_id IS NOT NULL OR wi_by_code.id IS NOT NULL)
      AND gi.quantity_received > 0;
  END IF;
  
  RETURN NEW;
END;
$$;