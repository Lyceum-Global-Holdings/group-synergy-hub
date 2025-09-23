-- Add size column to bill_of_materials table
ALTER TABLE public.bill_of_materials 
ADD COLUMN size text;