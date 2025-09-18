-- Fix the update_po_total_amount function to avoid ambiguous column references
CREATE OR REPLACE FUNCTION public.update_po_total_amount()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  po_total_amount DECIMAL(15,2);
  po_final_amount DECIMAL(15,2);
  po_tax_amount DECIMAL(15,2);
  po_discount_amount DECIMAL(15,2);
BEGIN
  -- Calculate total from all items for the specific PO
  SELECT COALESCE(SUM(pi.total_price), 0)
  INTO po_total_amount
  FROM po_items pi
  WHERE pi.po_id = COALESCE(NEW.po_id, OLD.po_id);
  
  -- Get current tax and discount amounts from the PO
  SELECT po.tax_amount, po.discount_amount
  INTO po_tax_amount, po_discount_amount
  FROM purchase_orders po
  WHERE po.id = COALESCE(NEW.po_id, OLD.po_id);
  
  -- Calculate final amount (total + tax - discount)
  po_final_amount := po_total_amount + COALESCE(po_tax_amount, 0) - COALESCE(po_discount_amount, 0);
  
  -- Update the PO totals
  UPDATE purchase_orders
  SET total_amount = po_total_amount,
      final_amount = po_final_amount,
      updated_at = now()
  WHERE id = COALESCE(NEW.po_id, OLD.po_id);
  
  RETURN COALESCE(NEW, OLD);
END;
$$;

-- Ensure triggers are properly set up
DROP TRIGGER IF EXISTS update_po_totals_trigger ON po_items;
CREATE TRIGGER update_po_totals_trigger
  AFTER INSERT OR UPDATE OR DELETE ON po_items
  FOR EACH ROW
  EXECUTE FUNCTION update_po_total_amount();

-- Also add trigger for PO quantity calculations
DROP TRIGGER IF EXISTS update_po_item_quantities_trigger ON po_items;
CREATE TRIGGER update_po_item_quantities_trigger
  BEFORE INSERT OR UPDATE ON po_items
  FOR EACH ROW
  EXECUTE FUNCTION update_po_item_quantities();