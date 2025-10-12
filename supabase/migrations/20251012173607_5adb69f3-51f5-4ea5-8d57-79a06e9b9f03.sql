-- Fix the auto_create_grn_on_po_sent function to use correct supplier address fields
CREATE OR REPLACE FUNCTION public.auto_create_grn_on_po_sent()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_grn_id UUID;
  v_grn_number TEXT;
  v_supplier_name TEXT;
  v_supplier_address TEXT;
  v_supplier_id UUID;
BEGIN
  -- Only proceed if status changed to 'sent' and wasn't 'sent' before
  IF NEW.status = 'sent' AND (OLD.status IS NULL OR OLD.status != 'sent') THEN
    
    -- Get supplier information and construct address from individual fields
    SELECT 
      name, 
      id,
      TRIM(CONCAT_WS(', ',
        NULLIF(address_line1, ''),
        NULLIF(address_line2, ''),
        NULLIF(city, ''),
        NULLIF(state, ''),
        NULLIF(postal_code, ''),
        NULLIF(country, '')
      ))
    INTO v_supplier_name, v_supplier_id, v_supplier_address
    FROM suppliers
    WHERE id = NEW.supplier_id;
    
    -- Use fallback if address is empty
    IF v_supplier_address IS NULL OR v_supplier_address = '' THEN
      v_supplier_address := 'Address not available';
    END IF;
    
    -- Generate GRN number
    v_grn_number := generate_grn_number();
    
    -- Create GRN header
    INSERT INTO goods_receipt_notes (
      grn_number,
      grn_date,
      po_id,
      po_number,
      supplier_id,
      supplier_name,
      supplier_address,
      status,
      total_value,
      company_id,
      created_by,
      remarks
    ) VALUES (
      v_grn_number,
      CURRENT_DATE,
      NEW.id,
      NEW.po_number,
      v_supplier_id,
      v_supplier_name,
      v_supplier_address,
      'draft',
      0,
      NEW.company_id,
      NEW.created_by,
      'Auto-generated from PO: ' || NEW.po_number
    )
    RETURNING id INTO v_grn_id;
    
    -- Create GRN items from PO items
    INSERT INTO grn_items (
      grn_id,
      item_code,
      item_name,
      description,
      warehouse_item_id,
      po_item_id,
      quantity_ordered,
      quantity_received,
      unit_of_measure,
      unit_price,
      total_cost,
      quality_status,
      remarks
    )
    SELECT
      v_grn_id,
      pi.item_code,
      pi.item_name,
      pi.description,
      pi.warehouse_item_id,
      pi.id,
      pi.quantity_ordered,
      0,
      pi.unit_of_measure,
      pi.unit_price,
      0,
      'good',
      'Pending receipt'
    FROM po_items pi
    WHERE pi.po_id = NEW.id;
    
  END IF;
  
  RETURN NEW;
END;
$$;