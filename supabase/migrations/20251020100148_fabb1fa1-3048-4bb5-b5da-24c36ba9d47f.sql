-- Phase 2 (Revised): Add database support for proper BOM linking without breaking legacy data

-- Step 1: Add indexes for better query performance on existing columns
CREATE INDEX IF NOT EXISTS idx_bom_product_master_id ON bill_of_materials(product_master_id) WHERE product_master_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_bom_finished_good_id ON bill_of_materials(finished_good_id) WHERE finished_good_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_bom_warehouse_item_id ON bill_of_materials(warehouse_item_id) WHERE warehouse_item_id IS NOT NULL;

-- Step 2: Add a new column to mark legacy BOMs vs new BOMs
ALTER TABLE bill_of_materials 
ADD COLUMN IF NOT EXISTS is_legacy_bom BOOLEAN DEFAULT false;

-- Step 3: Mark existing BOMs that don't follow the new pattern as legacy
UPDATE bill_of_materials
SET is_legacy_bom = true
WHERE product_master_id IS NULL OR finished_good_id IS NULL;

-- Step 4: Add comments explaining the relationship
COMMENT ON COLUMN bill_of_materials.product_master_id IS 'REQUIRED for new BOMs: Reference to the product master template that defines available colors and sizes';
COMMENT ON COLUMN bill_of_materials.finished_good_id IS 'REQUIRED for new BOMs: Reference to the specific finished good variant (specific size + color combination) that this BOM is for';
COMMENT ON COLUMN bill_of_materials.warehouse_item_id IS 'DEPRECATED: Only used for legacy BOMs. New BOMs must use product_master_id and finished_good_id instead.';
COMMENT ON COLUMN bill_of_materials.is_legacy_bom IS 'Indicates whether this BOM follows the old pattern (true) or new pattern (false). New BOMs must have both product_master_id and finished_good_id.';

-- Step 5: Create a validation function for new BOM inserts
CREATE OR REPLACE FUNCTION validate_new_bom()
RETURNS TRIGGER AS $$
BEGIN
  -- For new BOMs (not legacy), require both product_master_id and finished_good_id
  IF NEW.is_legacy_bom = false OR NEW.is_legacy_bom IS NULL THEN
    IF NEW.product_master_id IS NULL THEN
      RAISE EXCEPTION 'New BOMs must have a product_master_id. Legacy BOMs should set is_legacy_bom = true.';
    END IF;
    
    IF NEW.finished_good_id IS NULL THEN
      RAISE EXCEPTION 'New BOMs must have a finished_good_id. Legacy BOMs should set is_legacy_bom = true.';
    END IF;
    
    -- Ensure finished good is linked to the same product master (validation at DB level)
    IF NOT EXISTS (
      SELECT 1 FROM finished_goods 
      WHERE id = NEW.finished_good_id 
      AND product_master_id = NEW.product_master_id
    ) THEN
      RAISE EXCEPTION 'Finished good must be linked to the selected product master';
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Step 6: Create trigger to validate new BOMs (only for INSERT, not UPDATE to avoid breaking existing data)
DROP TRIGGER IF EXISTS validate_bom_on_insert ON bill_of_materials;
CREATE TRIGGER validate_bom_on_insert
  BEFORE INSERT ON bill_of_materials
  FOR EACH ROW
  EXECUTE FUNCTION validate_new_bom();

-- Step 7: Add a view to easily query only modern BOMs
CREATE OR REPLACE VIEW modern_boms AS
SELECT * FROM bill_of_materials
WHERE is_legacy_bom = false
  AND product_master_id IS NOT NULL
  AND finished_good_id IS NOT NULL;

COMMENT ON VIEW modern_boms IS 'View that shows only BOMs following the new pattern with proper product master and finished good links';
