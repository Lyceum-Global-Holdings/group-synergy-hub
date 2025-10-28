-- Add CPO reference fields to material_requests table
ALTER TABLE material_requests
ADD COLUMN cpo_id uuid REFERENCES customer_purchase_orders(id),
ADD COLUMN cpo_number text;

-- Create indexes for better query performance
CREATE INDEX idx_material_requests_cpo_id ON material_requests(cpo_id);
CREATE INDEX idx_material_requests_cpo_number ON material_requests(cpo_number);

-- Add comments for documentation
COMMENT ON COLUMN material_requests.cpo_id IS 'Reference to Customer Purchase Order that triggered this material request';
COMMENT ON COLUMN material_requests.cpo_number IS 'CPO number for easy reference and display';