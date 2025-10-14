-- Add warehouse_category column to classify warehouse purpose
ALTER TABLE warehouse_locations 
ADD COLUMN warehouse_category TEXT 
CHECK (warehouse_category IN ('raw_materials', 'finished_goods', 'general', 'wip', 'returns', 'quarantine'));

-- Set default value for existing records
UPDATE warehouse_locations 
SET warehouse_category = 'general' 
WHERE warehouse_category IS NULL;

-- Add index for better query performance
CREATE INDEX IF NOT EXISTS idx_warehouse_locations_category 
ON warehouse_locations(warehouse_category);

-- Add combined index for type and category filtering
CREATE INDEX IF NOT EXISTS idx_warehouse_locations_type_category 
ON warehouse_locations(type, warehouse_category);