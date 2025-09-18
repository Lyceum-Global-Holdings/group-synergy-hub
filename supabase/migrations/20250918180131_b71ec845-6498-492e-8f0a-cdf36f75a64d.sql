-- Add brand and asset_id fields to warehouse_assets table
ALTER TABLE warehouse_assets 
ADD COLUMN brand text,
ADD COLUMN asset_id text;

-- Create function to generate asset IDs with brand
CREATE OR REPLACE FUNCTION generate_asset_id(
  _category_id uuid, 
  _subcategory_id uuid DEFAULT NULL,
  _brand text DEFAULT NULL
) RETURNS text 
LANGUAGE plpgsql 
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  main_cat_code text;
  sub_cat_code text; 
  brand_code text;
  next_serial integer;
  asset_id text;
  combination_prefix text;
BEGIN
  -- Get main category code (first 3 letters)
  SELECT UPPER(LEFT(REGEXP_REPLACE(name, '[^A-Za-z]', '', 'g'), 3))
  INTO main_cat_code
  FROM asset_categories WHERE id = _category_id;
  main_cat_code := RPAD(COALESCE(main_cat_code, 'UNK'), 3, 'X');
  
  -- Get subcategory code or use 'GEN'
  IF _subcategory_id IS NOT NULL THEN
    SELECT UPPER(LEFT(REGEXP_REPLACE(name, '[^A-Za-z]', '', 'g'), 3))
    INTO sub_cat_code
    FROM asset_categories WHERE id = _subcategory_id;
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
  SELECT COALESCE(MAX(CAST(RIGHT(asset_id, 6) AS INTEGER)), 0) + 1
  INTO next_serial
  FROM warehouse_assets
  WHERE asset_id LIKE combination_prefix || '/%';
  
  -- Generate final asset ID
  asset_id := combination_prefix || '/' || LPAD(next_serial::text, 6, '0');
  
  RETURN asset_id;
END;
$$;

-- Create trigger function to auto-generate asset_id on insert
CREATE OR REPLACE FUNCTION auto_generate_asset_id()
RETURNS TRIGGER 
LANGUAGE plpgsql 
SET search_path TO 'public'
AS $$
BEGIN
  -- Generate asset_id if not provided
  IF NEW.asset_id IS NULL OR NEW.asset_id = '' THEN
    NEW.asset_id := generate_asset_id(NEW.category_id, NEW.subcategory_id, NEW.brand);
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create trigger to auto-generate asset_id on insert
CREATE TRIGGER trigger_auto_generate_asset_id
  BEFORE INSERT ON warehouse_assets
  FOR EACH ROW
  EXECUTE FUNCTION auto_generate_asset_id();

-- Add unique constraint on asset_id
ALTER TABLE warehouse_assets 
ADD CONSTRAINT warehouse_assets_asset_id_unique UNIQUE (asset_id);