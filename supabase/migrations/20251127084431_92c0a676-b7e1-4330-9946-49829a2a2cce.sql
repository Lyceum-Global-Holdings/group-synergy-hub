-- Security fixes for identified issues

-- 1. Remove duplicate profile view policy
DROP POLICY IF EXISTS "Users can view their own profile only" ON public.profiles;

-- 2. Fix any remaining functions without proper search_path
-- update_po_total_amount is missing search_path
CREATE OR REPLACE FUNCTION public.update_po_total_amount()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  po_total_amount DECIMAL(15,2);
  po_final_amount DECIMAL(15,2);
  po_tax_amount DECIMAL(15,2);
  po_discount_amount DECIMAL(15,2);
BEGIN
  SELECT COALESCE(SUM(pi.total_price), 0)
  INTO po_total_amount
  FROM po_items pi
  WHERE pi.po_id = COALESCE(NEW.po_id, OLD.po_id);
  
  SELECT po.tax_amount, po.discount_amount
  INTO po_tax_amount, po_discount_amount
  FROM purchase_orders po
  WHERE po.id = COALESCE(NEW.po_id, OLD.po_id);
  
  po_final_amount := po_total_amount + COALESCE(po_tax_amount, 0) - COALESCE(po_discount_amount, 0);
  
  UPDATE purchase_orders
  SET total_amount = po_total_amount,
      final_amount = po_final_amount,
      updated_at = now()
  WHERE id = COALESCE(NEW.po_id, OLD.po_id);
  
  RETURN COALESCE(NEW, OLD);
END;
$function$;