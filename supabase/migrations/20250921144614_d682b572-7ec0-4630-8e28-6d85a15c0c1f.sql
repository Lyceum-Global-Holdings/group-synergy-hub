-- Remove size column from bom_items table since size is now at BOM level
ALTER TABLE bom_items DROP COLUMN IF EXISTS size;