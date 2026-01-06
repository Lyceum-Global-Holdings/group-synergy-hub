-- Add unit_id column to warehouse_tools table
ALTER TABLE warehouse_tools 
ADD COLUMN unit_id UUID REFERENCES item_units(id);

-- Create index for performance
CREATE INDEX idx_warehouse_tools_unit_id ON warehouse_tools(unit_id);