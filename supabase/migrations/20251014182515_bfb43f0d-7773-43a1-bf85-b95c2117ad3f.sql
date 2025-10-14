-- Add product_master_id to bill_of_materials table
ALTER TABLE bill_of_materials 
ADD COLUMN product_master_id UUID REFERENCES product_master(id);

-- Create index for better query performance
CREATE INDEX idx_bom_product_master ON bill_of_materials(product_master_id);

-- Add comment
COMMENT ON COLUMN bill_of_materials.product_master_id IS 'Links BOM to Product Master template - primary method for BOM creation';