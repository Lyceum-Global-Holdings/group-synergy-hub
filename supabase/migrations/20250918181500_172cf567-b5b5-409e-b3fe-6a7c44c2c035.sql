-- Fix the generate_asset_id function to resolve ambiguous column reference
CREATE OR REPLACE FUNCTION public.generate_asset_id(_category_id uuid, _subcategory_id uuid DEFAULT NULL::uuid, _brand text DEFAULT NULL::text)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  main_cat_code text;
  sub_cat_code text; 
  brand_code text;
  next_serial integer;
  new_asset_id text;
  combination_prefix text;
BEGIN
  -- Get main category code (first 3 letters)
  SELECT UPPER(LEFT(REGEXP_REPLACE(ac.name, '[^A-Za-z]', '', 'g'), 3))
  INTO main_cat_code
  FROM asset_categories ac WHERE ac.id = _category_id;
  main_cat_code := RPAD(COALESCE(main_cat_code, 'UNK'), 3, 'X');
  
  -- Get subcategory code or use 'GEN'
  IF _subcategory_id IS NOT NULL THEN
    SELECT UPPER(LEFT(REGEXP_REPLACE(ac.name, '[^A-Za-z]', '', 'g'), 3))
    INTO sub_cat_code
    FROM asset_categories ac WHERE ac.id = _subcategory_id;
    sub_cat_code := RPAD(COALESCE(sub_cat_code, 'GEN'), 3, 'X');
  ELSE
    sub_cat_code := 'GEN';
  END IF;
  
  -- Get brand code (first 2 letters) or use 'XX'
  IF _brand IS NOT NULL AND _brand != '' THEN
    brand_code := RPAD(UPPER(LEFT(REGEXP_REPLACE(_brand, '[^A-Za-z]', '', 'g'), 2)), 2, 'X');
  ELSE
    brand_code := 'XX';
  END IF;
  
  -- Create combination prefix for serial numbering
  combination_prefix := main_cat_code || '/' || sub_cat_code || '/' || brand_code;
  
  -- Get next serial number for this specific combination
  SELECT COALESCE(MAX(CAST(RIGHT(wa.asset_id, 6) AS INTEGER)), 0) + 1
  INTO next_serial
  FROM warehouse_assets wa
  WHERE wa.asset_id LIKE combination_prefix || '/%';
  
  -- Generate final asset ID
  new_asset_id := combination_prefix || '/' || LPAD(next_serial::text, 6, '0');
  
  RETURN new_asset_id;
END;
$function$