-- Fix the generate_supplier_code function to avoid ambiguous column reference
CREATE OR REPLACE FUNCTION public.generate_supplier_code()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  next_number INTEGER;
  new_supplier_code TEXT;
BEGIN
  -- Get the next sequence number
  SELECT COALESCE(MAX(CAST(SUBSTRING(suppliers.supplier_code FROM 'SUP-(.*)') AS INTEGER)), 0) + 1
  INTO next_number
  FROM suppliers
  WHERE suppliers.supplier_code LIKE 'SUP-%';
  
  -- Generate supplier code: SUP-0001
  new_supplier_code := 'SUP-' || LPAD(next_number::TEXT, 4, '0');
  
  RETURN new_supplier_code;
END;
$$;