-- Add finished_good_id column to bill_of_materials table
ALTER TABLE public.bill_of_materials 
ADD COLUMN finished_good_id uuid REFERENCES public.finished_goods(id);

-- Add index for better performance
CREATE INDEX idx_bill_of_materials_finished_good_id ON public.bill_of_materials(finished_good_id);

-- Add constraint to ensure either finished_good_id OR warehouse_item_id is set, but not both
ALTER TABLE public.bill_of_materials 
ADD CONSTRAINT check_product_link CHECK (
  (finished_good_id IS NOT NULL AND warehouse_item_id IS NULL) OR
  (finished_good_id IS NULL AND warehouse_item_id IS NOT NULL) OR
  (finished_good_id IS NULL AND warehouse_item_id IS NULL)
);