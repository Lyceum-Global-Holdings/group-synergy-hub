-- Fix update_stock_on_grn_approval trigger to use correct stock_transactions columns
CREATE OR REPLACE FUNCTION update_stock_on_grn_approval()
RETURNS TRIGGER AS $$
DECLARE
  v_po_id UUID;
  po_fully_received BOOLEAN;
  po_any_received BOOLEAN;
BEGIN
  -- Only run when status changes to 'approved'
  IF NEW.status = 'approved' AND (OLD.status IS NULL OR OLD.status != 'approved') THEN
    
    -- Get the PO ID for later use
    SELECT po_id INTO v_po_id FROM goods_receipt_notes WHERE id = NEW.id;
    
    -- Step 1: Create stock transactions for each GRN item with correct column names
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
      COALESCE(gi.warehouse_item_id, wi_by_code.id),
      'goods_receipt',
      'grn',
      NEW.id,
      gi.quantity_received,
      COALESCE(wi.current_stock, wi_by_code.current_stock, 0),
      COALESCE(wi.current_stock, wi_by_code.current_stock, 0) + gi.quantity_received,
      gi.unit_price,
      gi.total_cost,
      'Stock received via GRN ' || NEW.grn_number,
      NEW.company_id,
      NEW.approved_by
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

    -- Step 2: Update warehouse_items current_stock
    UPDATE warehouse_items wi
    SET 
      current_stock = wi.current_stock + gi.quantity_received,
      updated_at = NOW()
    FROM grn_items gi
    WHERE gi.grn_id = NEW.id
      AND gi.quality_status = 'good'
      AND gi.quantity_received > 0
      AND wi.id = gi.warehouse_item_id;

    -- Also update by item_code if warehouse_item_id is null
    UPDATE warehouse_items wi
    SET 
      current_stock = wi.current_stock + gi.quantity_received,
      updated_at = NOW()
    FROM grn_items gi
    WHERE gi.grn_id = NEW.id
      AND gi.quality_status = 'good'
      AND gi.quantity_received > 0
      AND gi.warehouse_item_id IS NULL
      AND gi.item_code IS NOT NULL
      AND wi.item_code = gi.item_code
      AND (wi.company_id = NEW.company_id OR wi.company_id IS NULL);

    -- Step 3: Update PO items quantity_received
    IF v_po_id IS NOT NULL THEN
      UPDATE po_items poi
      SET 
        quantity_received = COALESCE(poi.quantity_received, 0) + gi.quantity_received,
        updated_at = NOW()
      FROM grn_items gi
      WHERE gi.grn_id = NEW.id
        AND gi.quantity_received > 0
        AND poi.po_id = v_po_id
        AND (
          (gi.po_item_id IS NOT NULL AND poi.id = gi.po_item_id)
          OR (gi.po_item_id IS NULL AND gi.item_code IS NOT NULL AND poi.item_code = gi.item_code)
        );

      -- Step 4: Update PO status based on received quantities (FIXED: use quantity_ordered)
      SELECT 
        BOOL_AND(COALESCE(quantity_received, 0) >= quantity_ordered),
        BOOL_OR(COALESCE(quantity_received, 0) > 0)
      INTO po_fully_received, po_any_received
      FROM po_items
      WHERE po_id = v_po_id;

      IF po_fully_received THEN
        UPDATE purchase_orders
        SET status = 'completed', updated_at = NOW()
        WHERE id = v_po_id;
      ELSIF po_any_received THEN
        UPDATE purchase_orders
        SET status = 'partially_received', updated_at = NOW()
        WHERE id = v_po_id;
      END IF;
    END IF;

    -- Step 5: Update bin allocations if bins are specified
    UPDATE bin_allocations ba
    SET 
      current_quantity = ba.current_quantity + gi.quantity_received,
      updated_at = NOW()
    FROM grn_items gi
    WHERE gi.grn_id = NEW.id
      AND gi.quality_status = 'good'
      AND gi.quantity_received > 0
      AND gi.bin_location_id IS NOT NULL
      AND ba.bin_id = gi.bin_location_id
      AND ba.item_id = gi.warehouse_item_id;

    -- Insert new bin allocations if they don't exist
    INSERT INTO bin_allocations (bin_id, item_id, current_quantity, company_id)
    SELECT 
      gi.bin_location_id,
      gi.warehouse_item_id,
      gi.quantity_received,
      NEW.company_id
    FROM grn_items gi
    WHERE gi.grn_id = NEW.id
      AND gi.quality_status = 'good'
      AND gi.quantity_received > 0
      AND gi.bin_location_id IS NOT NULL
      AND gi.warehouse_item_id IS NOT NULL
      AND NOT EXISTS (
        SELECT 1 FROM bin_allocations ba 
        WHERE ba.bin_id = gi.bin_location_id 
        AND ba.item_id = gi.warehouse_item_id
      )
    ON CONFLICT (bin_id, item_id) DO UPDATE
    SET current_quantity = bin_allocations.current_quantity + EXCLUDED.current_quantity,
        updated_at = NOW();

  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;