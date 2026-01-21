-- Add location_id column to construction_labour_master table
-- This allows assigning labour to specific warehouse locations

ALTER TABLE public.construction_labour_master 
ADD COLUMN location_id uuid REFERENCES warehouse_locations(id) ON DELETE SET NULL;

-- Create an index for better query performance
CREATE INDEX idx_construction_labour_master_location_id 
ON public.construction_labour_master(location_id);