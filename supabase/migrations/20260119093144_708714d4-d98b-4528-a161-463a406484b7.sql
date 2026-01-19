-- Add unit column to construction_inventory_transactions table
ALTER TABLE public.construction_inventory_transactions 
ADD COLUMN IF NOT EXISTS unit TEXT;