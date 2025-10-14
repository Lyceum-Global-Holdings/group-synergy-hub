-- Add color and size columns to customer_po_items table
ALTER TABLE public.customer_po_items 
ADD COLUMN color TEXT,
ADD COLUMN size TEXT;

-- Add comments for documentation
COMMENT ON COLUMN customer_po_items.color IS 'Selected color variant from finished goods';
COMMENT ON COLUMN customer_po_items.size IS 'Selected size variant from finished goods';

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_customer_po_items_color_size 
ON customer_po_items(color, size);