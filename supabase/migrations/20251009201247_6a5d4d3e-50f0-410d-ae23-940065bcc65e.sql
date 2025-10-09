-- Create trigger function to update PO quantities when GRN is approved
CREATE OR REPLACE FUNCTION update_po_quantities_on_grn_approval()
RETURNS TRIGGER AS $$
BEGIN
  -- Only execute when GRN status changes to 'approved'
  IF NEW.status = 'approved' AND (OLD.status IS NULL OR OLD.status != 'approved') THEN
    
    -- Update PO item quantities from GRN items (only "good" quality items)
    UPDATE po_items poi
    SET 
      quantity_received = quantity_received + gi.quantity_received,
      quantity_pending = quantity_ordered - (quantity_received + gi.quantity_received),
      updated_at = now()
    FROM grn_items gi
    WHERE gi.grn_id = NEW.id 
      AND gi.po_item_id = poi.id
      AND gi.quality_status = 'good';
    
    -- Update PO status based on receipt progress
    UPDATE purchase_orders
    SET 
      status = CASE
        -- All items fully received
        WHEN (SELECT COALESCE(SUM(quantity_pending), 0) FROM po_items WHERE po_id = NEW.po_id) = 0 
          THEN 'completed'
        -- Some items received
        WHEN (SELECT COALESCE(SUM(quantity_received), 0) FROM po_items WHERE po_id = NEW.po_id) > 0 
          THEN 'partially_received'
        ELSE status
      END,
      updated_at = now()
    WHERE id = NEW.po_id;
    
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger on goods_receipt_notes table
CREATE TRIGGER trigger_update_po_on_grn_approval
  AFTER INSERT OR UPDATE ON goods_receipt_notes
  FOR EACH ROW
  EXECUTE FUNCTION update_po_quantities_on_grn_approval();

-- Create validation function for PO status
CREATE OR REPLACE FUNCTION validate_po_for_grn(p_po_id uuid)
RETURNS boolean AS $$
DECLARE
  v_status text;
BEGIN
  SELECT status INTO v_status
  FROM purchase_orders
  WHERE id = p_po_id;
  
  -- Only allow GRN creation for approved/sent/acknowledged/partially_received POs
  RETURN v_status IN ('approved', 'sent', 'acknowledged', 'partially_received');
END;
$$ LANGUAGE plpgsql;