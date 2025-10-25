-- Migration 1: Fix update_stock_on_grn_approval trigger function
-- This fixes the company_id matching issue and adds actual stock updates

CREATE OR REPLACE FUNCTION update_stock_on_grn_approval()
RETURNS trigger AS $$
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
    WHERE gi.grn_id = NEW.id 
      AND gi.quality_status = 'good'
      AND gi.quantity_received > 0
      AND COALESCE(gi.warehouse_item_id, wi_by_code.id) IS NOT NULL;

    -- Update warehouse_items current_stock
    UPDATE warehouse_items
    SET current_stock = current_stock + gi.quantity_received,
        updated_at = NOW()
    FROM grn_items gi
    LEFT JOIN warehouse_items wi_by_code 
      ON gi.item_code IS NOT NULL 
      AND wi_by_code.item_code = gi.item_code 
      AND (wi_by_code.company_id = NEW.company_id OR wi_by_code.company_id IS NULL)
    WHERE warehouse_items.id = COALESCE(gi.warehouse_item_id, wi_by_code.id)
      AND gi.grn_id = NEW.id 
      AND gi.quality_status = 'good'
      AND gi.quantity_received > 0;

  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Migration 2: Create trigger to update warehouse stock from any stock transaction
CREATE OR REPLACE FUNCTION update_warehouse_stock_from_transaction()
RETURNS trigger AS $$
BEGIN
  -- Update the warehouse item's current stock to match the transaction's quantity_after
  UPDATE warehouse_items
  SET current_stock = NEW.quantity_after,
      updated_at = NOW()
  WHERE id = NEW.item_id;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop trigger if exists and create new one
DROP TRIGGER IF EXISTS update_stock_trigger ON stock_transactions;
CREATE TRIGGER update_stock_trigger
  AFTER INSERT ON stock_transactions
  FOR EACH ROW
  EXECUTE FUNCTION update_warehouse_stock_from_transaction();

-- Migration 3: Retroactively fix historical approved GRNs
-- This will process any approved GRNs that didn't create proper stock transactions

DO $$
DECLARE
  grn_record RECORD;
  item_record RECORD;
  warehouse_item_id_var UUID;
  current_stock_val NUMERIC;
BEGIN
  -- Loop through all approved GRNs
  FOR grn_record IN 
    SELECT id, grn_number, company_id, approved_by, approved_date
    FROM goods_receipt_notes
    WHERE status = 'approved'
  LOOP
    -- Loop through items in this GRN
    FOR item_record IN
      SELECT gi.*, wi.id as matched_warehouse_id, wi.current_stock as matched_current_stock
      FROM grn_items gi
      LEFT JOIN warehouse_items wi ON gi.warehouse_item_id = wi.id
      LEFT JOIN warehouse_items wi_by_code 
        ON gi.item_code IS NOT NULL 
        AND wi_by_code.item_code = gi.item_code 
        AND (wi_by_code.company_id = grn_record.company_id OR wi_by_code.company_id IS NULL)
      WHERE gi.grn_id = grn_record.id 
        AND gi.quality_status = 'good'
        AND gi.quantity_received > 0
        AND (gi.warehouse_item_id IS NOT NULL OR wi_by_code.id IS NOT NULL)
      ORDER BY gi.id
    LOOP
      -- Determine the warehouse_item_id to use
      warehouse_item_id_var := COALESCE(item_record.warehouse_item_id, item_record.matched_warehouse_id);
      
      IF warehouse_item_id_var IS NOT NULL THEN
        -- Check if stock transaction already exists
        IF NOT EXISTS (
          SELECT 1 FROM stock_transactions 
          WHERE reference_type = 'grn' 
            AND reference_id = grn_record.id 
            AND item_id = warehouse_item_id_var
        ) THEN
          -- Get current stock value
          SELECT current_stock INTO current_stock_val
          FROM warehouse_items
          WHERE id = warehouse_item_id_var;
          
          -- Calculate quantity_before (current - what should have been added)
          current_stock_val := COALESCE(current_stock_val, 0);
          
          -- Insert missing stock transaction
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
            created_by,
            created_at
          ) VALUES (
            warehouse_item_id_var,
            'goods_receipt',
            'grn',
            grn_record.id,
            item_record.quantity_received,
            current_stock_val,
            current_stock_val + item_record.quantity_received,
            item_record.unit_price,
            item_record.total_cost,
            CONCAT('GRN: ', grn_record.grn_number, ' - ', item_record.item_name, ' (Historical Fix)'),
            grn_record.company_id,
            grn_record.approved_by,
            COALESCE(grn_record.approved_date, NOW())
          );
          
          -- Update warehouse item stock (the trigger will handle new inserts, but we need to fix historical ones)
          UPDATE warehouse_items
          SET current_stock = current_stock + item_record.quantity_received,
              updated_at = NOW()
          WHERE id = warehouse_item_id_var;
          
        END IF;
      END IF;
    END LOOP;
  END LOOP;
END $$;