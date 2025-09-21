-- Add new columns to bom_items table for enhanced BOM functionality
ALTER TABLE bom_items 
ADD COLUMN item_code text,
ADD COLUMN colour text,
ADD COLUMN size text,
ADD COLUMN consumption numeric,
ADD COLUMN category text DEFAULT 'fabric';

-- Create index for category filtering
CREATE INDEX idx_bom_items_category ON bom_items(category);

-- Update existing records to have default category
UPDATE bom_items SET category = 'fabric' WHERE category IS NULL;