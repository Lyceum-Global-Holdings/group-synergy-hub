-- Add project_id column to construction_labour_master table for project allocation
ALTER TABLE public.construction_labour_master
ADD COLUMN project_id UUID REFERENCES public.construction_projects(id) ON DELETE SET NULL;

-- Create index for better query performance
CREATE INDEX idx_construction_labour_master_project_id ON public.construction_labour_master(project_id);