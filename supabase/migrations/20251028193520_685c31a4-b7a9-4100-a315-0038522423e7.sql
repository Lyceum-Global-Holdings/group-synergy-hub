-- Add available_quantity generated column to warehouse_items
ALTER TABLE warehouse_items 
ADD COLUMN IF NOT EXISTS available_quantity NUMERIC(15,2) 
  GENERATED ALWAYS AS (current_stock - COALESCE(reserved_quantity, 0)) STORED;

-- Add index for better query performance
CREATE INDEX IF NOT EXISTS idx_warehouse_items_available_quantity 
ON warehouse_items(available_quantity) WHERE available_quantity > 0;

-- Add comment
COMMENT ON COLUMN warehouse_items.available_quantity IS 'Calculated as current_stock - reserved_quantity. Auto-updated when either field changes.';