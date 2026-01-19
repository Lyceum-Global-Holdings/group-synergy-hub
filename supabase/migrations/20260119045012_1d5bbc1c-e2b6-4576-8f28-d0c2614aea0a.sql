-- Add quantity and location_id columns to construction_inventory_master table
ALTER TABLE public.construction_inventory_master
ADD COLUMN quantity NUMERIC(10,2) NOT NULL DEFAULT 0,
ADD COLUMN location_id UUID REFERENCES public.warehouse_locations(id);

-- Add index for location lookup
CREATE INDEX idx_construction_inventory_master_location 
ON public.construction_inventory_master(location_id);

-- Add comment for documentation
COMMENT ON COLUMN public.construction_inventory_master.quantity IS 'Current quantity of the inventory item';
COMMENT ON COLUMN public.construction_inventory_master.location_id IS 'Reference to warehouse location where item is stored';