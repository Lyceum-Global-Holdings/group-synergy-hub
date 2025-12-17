-- Add location_id column to warehouse_items table for warehouse allocation
ALTER TABLE public.warehouse_items
ADD COLUMN location_id UUID REFERENCES public.warehouse_locations(id) ON DELETE SET NULL;

-- Create index for better query performance
CREATE INDEX idx_warehouse_items_location_id ON public.warehouse_items(location_id);

-- Add comment for documentation
COMMENT ON COLUMN public.warehouse_items.location_id IS 'The warehouse location where this item is primarily stored';