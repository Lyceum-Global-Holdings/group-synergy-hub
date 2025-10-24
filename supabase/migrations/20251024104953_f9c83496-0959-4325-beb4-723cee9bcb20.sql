-- Create function to generate next supplier code with locking to prevent race conditions
CREATE OR REPLACE FUNCTION generate_next_supplier_code(p_company_id UUID)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_last_code TEXT;
  v_next_number INTEGER;
  v_new_code TEXT;
  v_max_attempts INTEGER := 10;
  v_attempt INTEGER := 0;
BEGIN
  LOOP
    -- Lock the table row-level to prevent concurrent code generation
    SELECT supplier_code INTO v_last_code
    FROM suppliers
    WHERE company_id = p_company_id
    ORDER BY supplier_code DESC
    LIMIT 1
    FOR UPDATE SKIP LOCKED;
    
    -- Extract number from last code (handles both SUP00001 and SUP-0001 formats)
    IF v_last_code IS NULL THEN
      v_next_number := 1;
    ELSE
      v_next_number := COALESCE(
        CAST(REGEXP_REPLACE(v_last_code, '[^0-9]', '', 'g') AS INTEGER),
        0
      ) + 1;
    END IF;
    
    -- Generate new code in SUP00001 format (no dash)
    v_new_code := 'SUP' || LPAD(v_next_number::TEXT, 5, '0');
    
    -- Check if code already exists (safety check)
    IF NOT EXISTS (
      SELECT 1 FROM suppliers 
      WHERE supplier_code = v_new_code 
      AND company_id = p_company_id
    ) THEN
      RETURN v_new_code;
    END IF;
    
    -- If code exists, increment and try again
    v_attempt := v_attempt + 1;
    IF v_attempt >= v_max_attempts THEN
      RAISE EXCEPTION 'Could not generate unique supplier code after % attempts', v_max_attempts;
    END IF;
    
    v_next_number := v_next_number + 1;
  END LOOP;
END;
$$;

COMMENT ON FUNCTION generate_next_supplier_code IS 'Atomically generates the next available supplier code with proper locking to prevent race conditions';