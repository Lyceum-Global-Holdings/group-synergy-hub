-- Drop the existing trigger and function first
DROP TRIGGER IF EXISTS trigger_update_po_status_on_grn_approval ON goods_receipt_notes;
DROP FUNCTION IF EXISTS update_po_status_on_items_complete();

-- Create updated trigger to update PO status based on item completion
CREATE OR REPLACE FUNCTION update_po_status_on_items_complete()
RETURNS TRIGGER AS $$
DECLARE
  v_all_items_complete BOOLEAN;
  v_any_item_received BOOLEAN;
BEGIN
  -- Check if this is a GRN approval
  IF NEW.status = 'approved' AND (OLD.status IS NULL OR OLD.status != 'approved') THEN
    -- Check if all items in the PO are complete
    SELECT 
      NOT EXISTS (
        SELECT 1 FROM po_items
        WHERE po_id = NEW.po_id
        AND quantity_received < quantity_ordered
      ),
      EXISTS (
        SELECT 1 FROM po_items
        WHERE po_id = NEW.po_id
        AND quantity_received > 0
      )
    INTO v_all_items_complete, v_any_item_received;
    
    -- Update PO status accordingly
    UPDATE purchase_orders
    SET 
      status = CASE
        WHEN v_all_items_complete THEN 'completed'
        WHEN v_any_item_received THEN 'partially_received'
        ELSE status
      END,
      updated_at = now()
    WHERE id = NEW.po_id;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Create trigger on goods_receipt_notes
CREATE TRIGGER trigger_update_po_status_on_grn_approval
  AFTER INSERT OR UPDATE ON goods_receipt_notes
  FOR EACH ROW
  EXECUTE FUNCTION update_po_status_on_items_complete();