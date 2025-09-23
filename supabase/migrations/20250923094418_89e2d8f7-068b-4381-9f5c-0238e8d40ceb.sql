-- Add warehouse_item_id column to bom_items table to link BOM items to warehouse items
ALTER TABLE public.bom_items 
ADD COLUMN warehouse_item_id UUID REFERENCES public.warehouse_items(id);