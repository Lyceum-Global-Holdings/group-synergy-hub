-- Fix the check_duplicate_supplier function to use correct column names
DROP FUNCTION IF EXISTS check_duplicate_supplier(TEXT, TEXT, TEXT, TEXT);

CREATE OR REPLACE FUNCTION check_duplicate_supplier(
  p_supplier_name TEXT,
  p_email TEXT DEFAULT NULL,
  p_phone TEXT DEFAULT NULL,
  p_tax_id TEXT DEFAULT NULL
) RETURNS TABLE(
  id UUID,
  supplier_name TEXT,
  email TEXT,
  phone TEXT,
  tax_id TEXT,
  match_reason TEXT
) 
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    s.id,
    s.name as supplier_name,
    s.email,
    s.phone,
    s.tax_id,
    CASE 
      WHEN s.tax_id IS NOT NULL AND s.tax_id = p_tax_id THEN 'tax_id'
      WHEN s.email IS NOT NULL AND s.email = p_email THEN 'email'
      WHEN s.phone IS NOT NULL AND s.phone = p_phone THEN 'phone'
      WHEN LOWER(s.name) = LOWER(p_supplier_name) THEN 'name'
      ELSE 'unknown'
    END as match_reason
  FROM suppliers s
  WHERE 
    (p_tax_id IS NOT NULL AND s.tax_id = p_tax_id) OR
    (p_email IS NOT NULL AND s.email = p_email) OR
    (p_phone IS NOT NULL AND s.phone = p_phone) OR
    LOWER(s.name) = LOWER(p_supplier_name)
  LIMIT 5;
END;
$$;