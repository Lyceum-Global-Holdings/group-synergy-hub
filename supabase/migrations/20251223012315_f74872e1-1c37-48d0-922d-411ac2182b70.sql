-- Create project_warehouse_allocations table
CREATE TABLE public.project_warehouse_allocations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.construction_projects(id) ON DELETE CASCADE,
  warehouse_location_id UUID NOT NULL REFERENCES public.warehouse_locations(id) ON DELETE CASCADE,
  is_primary BOOLEAN DEFAULT false,
  allocated_date DATE DEFAULT CURRENT_DATE,
  notes TEXT,
  company_id UUID REFERENCES public.companies(id),
  created_by UUID,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(project_id, warehouse_location_id)
);

-- Enable RLS
ALTER TABLE public.project_warehouse_allocations ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Users can view project warehouse allocations"
  ON public.project_warehouse_allocations
  FOR SELECT
  USING (true);

CREATE POLICY "Users can insert project warehouse allocations"
  ON public.project_warehouse_allocations
  FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Users can update project warehouse allocations"
  ON public.project_warehouse_allocations
  FOR UPDATE
  USING (true);

CREATE POLICY "Users can delete project warehouse allocations"
  ON public.project_warehouse_allocations
  FOR DELETE
  USING (true);

-- Create trigger for updated_at
CREATE TRIGGER update_project_warehouse_allocations_updated_at
  BEFORE UPDATE ON public.project_warehouse_allocations
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Create index for faster lookups
CREATE INDEX idx_project_warehouse_allocations_project_id ON public.project_warehouse_allocations(project_id);
CREATE INDEX idx_project_warehouse_allocations_warehouse_id ON public.project_warehouse_allocations(warehouse_location_id);