-- Fix the generate_po_number function to avoid ambiguous column reference
CREATE OR REPLACE FUNCTION public.generate_po_number()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  next_number INTEGER;
  new_po_number TEXT;
BEGIN
  -- Get the next sequence number for today
  SELECT COALESCE(MAX(CAST(SUBSTRING(purchase_orders.po_number FROM 'PO-' || TO_CHAR(CURRENT_DATE, 'YYYYMMDD') || '-(.*)') AS INTEGER)), 0) + 1
  INTO next_number
  FROM purchase_orders
  WHERE purchase_orders.po_number LIKE 'PO-' || TO_CHAR(CURRENT_DATE, 'YYYYMMDD') || '-%';
  
  -- Generate PO number: PO-YYYYMMDD-001
  new_po_number := 'PO-' || TO_CHAR(CURRENT_DATE, 'YYYYMMDD') || '-' || LPAD(next_number::TEXT, 3, '0');
  
  RETURN new_po_number;
END;
$$;