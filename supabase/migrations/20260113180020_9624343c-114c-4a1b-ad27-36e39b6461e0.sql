-- Fix the column reference error in update_stock_on_grn_approval trigger
-- Change 'quantity' to 'quantity_ordered' in the PO status check

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
  IF NEW.status = 'approved' AND (OLD.status IS NULL OR OLD.status != 'approved') THEN
    
    v_po_id := NEW.po_id;
    
    -- 1. Insert stock transactions for each GRN item
    INSERT INTO stock_transactions (
      warehouse_item_id,
      transaction_type,
      quantity,
      reference_type,
      reference_id,
      notes,
      performed_by,
      company_id
    )
    SELECT 
      COALESCE(gi.warehouse_item_id, wi_by_code.id),
      'receipt',
      gi.quantity_received,
      'grn',
      NEW.id,
      'Stock received via GRN ' || NEW.grn_number,
      NEW.approved_by,
      NEW.company_id
    FROM grn_items gi
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
    SET current_stock = target.current_stock + source.total_received,
        updated_at = NOW()
    FROM (
      SELECT 
        COALESCE(gi.warehouse_item_id, wi_by_code.id) as item_id,
        SUM(gi.quantity_received) as total_received
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
    ) source
    WHERE target.id = source.item_id;

    -- 3. Update po_items.quantity_received
    UPDATE po_items target
    SET quantity_received = COALESCE(target.quantity_received, 0) + source.total_received,
        updated_at = NOW()
    FROM (
      SELECT 
        gi.po_item_id,
        SUM(gi.quantity_received) as total_received
      FROM grn_items gi
      WHERE gi.grn_id = NEW.id 
        AND gi.po_item_id IS NOT NULL
        AND gi.quantity_received > 0
      GROUP BY gi.po_item_id
    ) source
    WHERE target.id = source.po_item_id;

    -- 4. Update purchase_orders status based on received quantities
    IF v_po_id IS NOT NULL THEN
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

    -- 5. Update warehouse_bin_allocations
    UPDATE warehouse_bin_allocations target
    SET allocated_quantity = target.allocated_quantity + updates.qty_received,
        updated_at = NOW()
    FROM (
      SELECT DISTINCT ON (resolved_item_id)
             resolved_item_id,
             qty_received,
             first_allocation_id
      FROM (
        SELECT 
          COALESCE(gi.warehouse_item_id, wi_by_code.id) as resolved_item_id,
          SUM(gi.quantity_received) OVER (PARTITION BY COALESCE(gi.warehouse_item_id, wi_by_code.id)) as qty_received,
          (
            SELECT wba.id 
            FROM warehouse_bin_allocations wba 
            WHERE wba.warehouse_item_id = COALESCE(gi.warehouse_item_id, wi_by_code.id)
            ORDER BY wba.created_at ASC
            LIMIT 1
          ) as first_allocation_id
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
      ) subq
      WHERE first_allocation_id IS NOT NULL
    ) updates
    WHERE target.id = updates.first_allocation_id;

  END IF;
  
  RETURN NEW;
END;
$function$;