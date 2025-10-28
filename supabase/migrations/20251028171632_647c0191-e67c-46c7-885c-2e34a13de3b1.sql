-- Remove colour column from bom_items table
ALTER TABLE public.bom_items DROP COLUMN IF EXISTS colour;