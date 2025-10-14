-- Add product_master_id to customer_po_items table
ALTER TABLE customer_po_items 
ADD COLUMN product_master_id UUID REFERENCES product_master(id);

-- Add index for better query performance
CREATE INDEX idx_customer_po_items_product_master_id ON customer_po_items(product_master_id);

-- Add comment
COMMENT ON COLUMN customer_po_items.product_master_id IS 'Reference to product master template for make-to-order items';