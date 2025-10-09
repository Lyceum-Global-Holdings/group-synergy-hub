-- Fix function search path mutable warnings for BPO trigger functions

-- Fix update_bpo_remaining_value function
CREATE OR REPLACE FUNCTION public.update_bpo_remaining_value()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE blanket_purchase_orders
  SET remaining_value = calculate_bpo_remaining_value(COALESCE(NEW.bpo_id, OLD.bpo_id)),
      updated_at = now()
  WHERE id = COALESCE(NEW.bpo_id, OLD.bpo_id);
  
  RETURN COALESCE(NEW, OLD);
END;
$$;

-- Fix update_bpo_item_remaining_quantity function
CREATE OR REPLACE FUNCTION public.update_bpo_item_remaining_quantity()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE blanket_po_items
  SET remaining_quantity = calculate_bpo_item_remaining_quantity(COALESCE(NEW.bpo_item_id, OLD.bpo_item_id)),
      quantity_released = COALESCE((
        SELECT SUM(bri.quantity_approved)
        FROM blanket_po_release_items bri
        JOIN blanket_po_releases br ON bri.release_id = br.id
        WHERE bri.bpo_item_id = COALESCE(NEW.bpo_item_id, OLD.bpo_item_id)
          AND br.release_status IN ('approved', 'sent', 'received', 'completed')
      ), 0),
      updated_at = now()
  WHERE id = COALESCE(NEW.bpo_item_id, OLD.bpo_item_id);
  
  RETURN COALESCE(NEW, OLD);
END;
$$;

-- Fix update_release_total_amount function
CREATE OR REPLACE FUNCTION public.update_release_total_amount()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  release_total NUMERIC(15,2);
BEGIN
  SELECT COALESCE(SUM(total_price), 0)
  INTO release_total
  FROM blanket_po_release_items
  WHERE release_id = COALESCE(NEW.release_id, OLD.release_id);
  
  UPDATE blanket_po_releases
  SET total_amount = release_total,
      updated_at = now()
  WHERE id = COALESCE(NEW.release_id, OLD.release_id);
  
  RETURN COALESCE(NEW, OLD);
END;
$$;

-- Fix initialize_bpo_remaining_value function
CREATE OR REPLACE FUNCTION public.initialize_bpo_remaining_value()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.remaining_value := NEW.total_contract_value;
  RETURN NEW;
END;
$$;