-- Phase 2 (Final): Soft migration with application-level validation

-- Mark incomplete BOMs as draft for review
UPDATE bill_of_materials
SET 
  status = 'draft',
  description = CASE 
    WHEN description IS NULL OR description = '' THEN '⚠️ Requires Product Master linkage'
    WHEN description NOT LIKE 'LEGACY%' AND description NOT LIKE '⚠️%' THEN '⚠️ ' || description
    ELSE description
  END
WHERE (product_master_id IS NULL AND finished_good_id IS NOT NULL)
   OR (product_master_id IS NOT NULL AND finished_good_id IS NULL);

-- Add indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_bom_product_master_id ON bill_of_materials(product_master_id) WHERE product_master_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_bom_finished_good_id ON bill_of_materials(finished_good_id) WHERE finished_good_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_bom_warehouse_item_id ON bill_of_materials(warehouse_item_id) WHERE warehouse_item_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_bom_status ON bill_of_materials(status);

-- Add comments explaining the relationship
COMMENT ON COLUMN bill_of_materials.product_master_id IS 'Reference to the product master template that defines available colors and sizes. Required for new BOMs created after Phase 1 implementation.';
COMMENT ON COLUMN bill_of_materials.finished_good_id IS 'Reference to the specific finished good variant (specific size + color combination). Must be linked to the product_master_id.';
COMMENT ON COLUMN bill_of_materials.warehouse_item_id IS 'DEPRECATED: Legacy field for backward compatibility. New BOMs should use product_master_id + finished_good_id instead.';
COMMENT ON COLUMN bill_of_materials.size IS 'Product size - auto-populated from finished good variant';
COMMENT ON COLUMN bill_of_materials.status IS 'BOM status: draft (needs review), active (approved), inactive (deprecated)';

-- Add validation trigger for new BOMs only (INSERT operations)
CREATE OR REPLACE FUNCTION validate_new_bom_linkage()
RETURNS TRIGGER AS $$
BEGIN
  -- Only validate on INSERT (new BOMs)
  IF (TG_OP = 'INSERT') THEN
    -- New BOMs must have both product_master_id and finished_good_id
    IF NEW.product_master_id IS NULL OR NEW.finished_good_id IS NULL THEN
      RAISE EXCEPTION 'New BOMs must have both product_master_id and finished_good_id. Please select a Product Master and then a Finished Good.';
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop old trigger if exists
DROP TRIGGER IF EXISTS bom_linkage_validation ON bill_of_materials;

-- Create new trigger for INSERT only
CREATE TRIGGER bom_new_linkage_validation
BEFORE INSERT ON bill_of_materials
FOR EACH ROW
EXECUTE FUNCTION validate_new_bom_linkage();
