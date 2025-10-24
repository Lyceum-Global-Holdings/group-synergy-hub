-- Create global sequence for supplier codes
CREATE SEQUENCE IF NOT EXISTS public.supplier_code_seq;

-- Seed the sequence to current maximum to avoid collisions with existing data
DO $$ 
DECLARE 
  v_max INTEGER;
BEGIN
  SELECT COALESCE(MAX(CAST(REGEXP_REPLACE(supplier_code, '[^0-9]', '', 'g') AS INTEGER)), 0)
  INTO v_max 
  FROM public.suppliers
  WHERE supplier_code IS NOT NULL AND supplier_code != '';
  
  PERFORM setval('public.supplier_code_seq', v_max);
END $$;

-- Replace function to use sequence for globally unique codes
CREATE OR REPLACE FUNCTION public.generate_next_supplier_code(p_company_id UUID)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_next BIGINT;
  v_code TEXT;
BEGIN
  -- Get next value from global sequence
  v_next := nextval('public.supplier_code_seq');
  
  -- Format as SUP00001, SUP00002, etc.
  v_code := 'SUP' || LPAD(v_next::TEXT, 5, '0');
  
  RETURN v_code;
END;
$$;

COMMENT ON FUNCTION public.generate_next_supplier_code(UUID) IS 'Generates globally unique supplier codes using a sequence';

-- Grant execute to authenticated users
GRANT EXECUTE ON FUNCTION public.generate_next_supplier_code(UUID) TO authenticated;