-- Add issued_to_location_id column to stock_transactions table
-- This tracks which project storage location stock was issued to
ALTER TABLE stock_transactions 
ADD COLUMN issued_to_location_id UUID REFERENCES warehouse_locations(id);

-- Add index for efficient querying by location
CREATE INDEX idx_stock_transactions_issued_to_location 
ON stock_transactions(issued_to_location_id) 
WHERE issued_to_location_id IS NOT NULL;

-- Add comment for documentation
COMMENT ON COLUMN stock_transactions.issued_to_location_id IS 'Reference to the warehouse location (project storage) that stock was issued to';