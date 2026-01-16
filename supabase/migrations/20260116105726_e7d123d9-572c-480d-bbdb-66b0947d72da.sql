-- Add section and image_url columns to construction_inventory_master table
ALTER TABLE public.construction_inventory_master 
ADD COLUMN IF NOT EXISTS section text,
ADD COLUMN IF NOT EXISTS image_url text;