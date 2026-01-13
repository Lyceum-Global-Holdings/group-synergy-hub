-- Fix po_status values: 'received' -> 'completed', 'partial' -> 'partially_received'

CREATE OR REPLACE FUNCTION update_stock_on_grn_approval()
RETURNS TRIGGER AS $$
BEGIN
  -- Only proceed if status changed to 'approved'
  IF NEW.status = 'approved' AND (OLD.status IS NULL OR OLD.status != 'approved') THEN
    
    -- Step 1: Create stock transactions for received items
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

    -- Step 2: Update warehouse items current_stock
    UPDATE warehouse_items wi
    SET 
      current_stock = wi.current_stock + gi.quantity_received,
      updated_at = NOW()
    FROM grn_items gi
    WHERE gi.grn_id = NEW.id
      AND gi.quality_status = 'good'
      AND gi.quantity_received > 0
      AND wi.id = gi.warehouse_item_id;

    -- Also update items matched by item_code
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

    -- Step 3: Update PO items received quantity if linked to a PO
    IF NEW.po_id IS NOT NULL THEN
      UPDATE po_items poi
      SET 
        quantity_received = COALESCE(poi.quantity_received, 0) + gi.quantity_received,
        updated_at = NOW()
      FROM grn_items gi
      WHERE gi.grn_id = NEW.id
        AND gi.quality_status = 'good'
        AND gi.quantity_received > 0
        AND gi.po_item_id IS NOT NULL
        AND poi.id = gi.po_item_id;
    END IF;

    -- Step 4: Update PO status if all items received
    IF NEW.po_id IS NOT NULL THEN
      UPDATE purchase_orders po
      SET 
        status = CASE 
          WHEN (
            SELECT COUNT(*) 
            FROM po_items poi 
            WHERE poi.po_id = po.id 
            AND COALESCE(poi.quantity_received, 0) < poi.quantity_ordered
          ) = 0 THEN 'completed'::po_status
          WHEN (
            SELECT COUNT(*) 
            FROM po_items poi 
            WHERE poi.po_id = po.id 
            AND COALESCE(poi.quantity_received, 0) > 0
          ) > 0 THEN 'partially_received'::po_status
          ELSE po.status
        END,
        updated_at = NOW()
      WHERE po.id = NEW.po_id;
    END IF;

    -- Step 5: Update warehouse bin allocations if bins are specified
    UPDATE warehouse_bin_allocations wba
    SET 
      allocated_quantity = wba.allocated_quantity + gi.quantity_received,
      updated_at = NOW()
    FROM grn_items gi
    WHERE gi.grn_id = NEW.id
      AND gi.quality_status = 'good'
      AND gi.quantity_received > 0
      AND gi.bin_location_id IS NOT NULL
      AND wba.bin_id = gi.bin_location_id
      AND wba.warehouse_item_id = gi.warehouse_item_id;

    -- Insert new bin allocations if they don't exist
    INSERT INTO warehouse_bin_allocations (bin_id, warehouse_item_id, allocated_quantity, company_id)
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
        SELECT 1 FROM warehouse_bin_allocations wba 
        WHERE wba.bin_id = gi.bin_location_id 
        AND wba.warehouse_item_id = gi.warehouse_item_id
      )
    ON CONFLICT (bin_id, warehouse_item_id) DO UPDATE
    SET allocated_quantity = warehouse_bin_allocations.allocated_quantity + EXCLUDED.allocated_quantity,
        updated_at = NOW();

  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;