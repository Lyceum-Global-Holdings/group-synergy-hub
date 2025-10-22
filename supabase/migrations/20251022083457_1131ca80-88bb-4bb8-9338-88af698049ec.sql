-- Add style_no and unit_of_measure fields to customer_po_items table
-- These fields are needed for enhanced matching in Material Demand Planning

ALTER TABLE customer_po_items 
ADD COLUMN IF NOT EXISTS style_no VARCHAR(100),
ADD COLUMN IF NOT EXISTS unit_of_measure VARCHAR(50) DEFAULT 'pcs';