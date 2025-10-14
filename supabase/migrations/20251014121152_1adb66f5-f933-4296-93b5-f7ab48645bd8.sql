-- Fix the movement_type in finished goods issue trigger to use 'sales_issue' instead of 'issue'
-- This matches the check constraint on finished_goods_movements table

CREATE OR REPLACE FUNCTION public.update_stock_on_fg_issue()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'issued' AND (OLD.status IS NULL OR OLD.status != 'issued') THEN
    -- Create finished goods movements for all issue items
    INSERT INTO finished_goods_movements (
      finished_good_id,
      movement_type,
      reference_type,
      reference_id,
      quantity_change,
      quantity_before,
      quantity_after,
      notes,
      company_id,
      created_by
    )
    SELECT 
      fgii.finished_good_id,
      'sales_issue',
      'sales_order',
      NEW.sales_order_id,
      -fgii.quantity_issued,
      fg.current_stock,
      fg.current_stock - fgii.quantity_issued,
      'Issued for Sales Order: ' || NEW.issue_number,
      NEW.company_id,
      NEW.issued_by
    FROM finished_goods_issue_items fgii
    JOIN finished_goods fg ON fgii.finished_good_id = fg.id
    WHERE fgii.issue_id = NEW.id;

    -- Update sales order item quantities
    UPDATE sales_order_items soi
    SET 
      quantity_issued = soi.quantity_issued + fgii.quantity_issued,
      status = CASE 
        WHEN soi.quantity_issued + fgii.quantity_issued >= soi.quantity_ordered THEN 'issued'
        WHEN soi.quantity_issued + fgii.quantity_issued > 0 THEN 'partial'
        ELSE 'pending'
      END,
      updated_at = NOW()
    FROM finished_goods_issue_items fgii
    WHERE fgii.issue_id = NEW.id
    AND fgii.sales_order_item_id = soi.id;
  END IF;
  
  RETURN NEW;
END;
$$;