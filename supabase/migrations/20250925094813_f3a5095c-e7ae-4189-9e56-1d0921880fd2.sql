-- Add multi-size support to finished_goods table
ALTER TABLE finished_goods 
ADD COLUMN available_sizes JSONB DEFAULT '[]'::jsonb,
ADD COLUMN size_specific_stock JSONB DEFAULT '{}'::jsonb;

-- Add multi-size support to bill_of_materials table  
ALTER TABLE bill_of_materials
ADD COLUMN target_sizes JSONB DEFAULT '[]'::jsonb,
ADD COLUMN size_specific BOOLEAN DEFAULT false;

-- Add comments for documentation
COMMENT ON COLUMN finished_goods.available_sizes IS 'Array of available sizes for this product (e.g., ["S", "M", "L"])';
COMMENT ON COLUMN finished_goods.size_specific_stock IS 'JSON object with stock levels per size (e.g., {"S": 10, "M": 15, "L": 8})';
COMMENT ON COLUMN bill_of_materials.target_sizes IS 'Array of sizes this BOM applies to (e.g., ["S", "M", "L"])';
COMMENT ON COLUMN bill_of_materials.size_specific IS 'Whether this BOM has size-specific material requirements';

-- Update trigger to sync available_sizes with size field for backward compatibility
CREATE OR REPLACE FUNCTION sync_finished_goods_sizes()
RETURNS TRIGGER AS $$
BEGIN
  -- If available_sizes is updated and not empty, update size field with first item
  IF NEW.available_sizes IS NOT NULL AND jsonb_array_length(NEW.available_sizes) > 0 THEN
    NEW.size := NEW.available_sizes->>0;
  END IF;
  
  -- If size is updated and available_sizes is empty, populate available_sizes
  IF NEW.size IS NOT NULL AND NEW.size != '' AND (NEW.available_sizes IS NULL OR jsonb_array_length(NEW.available_sizes) = 0) THEN
    NEW.available_sizes := jsonb_build_array(NEW.size);
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER sync_finished_goods_sizes_trigger
  BEFORE INSERT OR UPDATE ON finished_goods
  FOR EACH ROW
  EXECUTE FUNCTION sync_finished_goods_sizes();