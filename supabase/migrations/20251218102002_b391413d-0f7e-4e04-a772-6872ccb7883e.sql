-- Create project_floor_drawings table
CREATE TABLE public.project_floor_drawings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.construction_projects(id) ON DELETE CASCADE,
  company_id UUID REFERENCES public.companies(id),
  drawing_name VARCHAR(255) NOT NULL,
  description TEXT,
  floor_number INTEGER DEFAULT 0,
  image_url TEXT NOT NULL,
  wall_height NUMERIC DEFAULT 3.0,
  scale_factor NUMERIC DEFAULT 1.0,
  created_by UUID,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes
CREATE INDEX idx_floor_drawings_project ON public.project_floor_drawings(project_id);
CREATE INDEX idx_floor_drawings_company ON public.project_floor_drawings(company_id);

-- Enable RLS
ALTER TABLE public.project_floor_drawings ENABLE ROW LEVEL SECURITY;

-- RLS Policies using profiles.company_id
CREATE POLICY "Users can view floor drawings for their company projects"
ON public.project_floor_drawings FOR SELECT
USING (
  company_id IN (
    SELECT p.company_id FROM public.profiles p WHERE p.user_id = auth.uid()
  )
  OR public.is_super_admin(auth.uid())
);

CREATE POLICY "Users can create floor drawings for their company projects"
ON public.project_floor_drawings FOR INSERT
WITH CHECK (
  company_id IN (
    SELECT p.company_id FROM public.profiles p WHERE p.user_id = auth.uid()
  )
  OR public.is_super_admin(auth.uid())
);

CREATE POLICY "Users can update floor drawings for their company projects"
ON public.project_floor_drawings FOR UPDATE
USING (
  company_id IN (
    SELECT p.company_id FROM public.profiles p WHERE p.user_id = auth.uid()
  )
  OR public.is_super_admin(auth.uid())
);

CREATE POLICY "Users can delete floor drawings for their company projects"
ON public.project_floor_drawings FOR DELETE
USING (
  company_id IN (
    SELECT p.company_id FROM public.profiles p WHERE p.user_id = auth.uid()
  )
  OR public.is_super_admin(auth.uid())
);

-- Trigger for updated_at
CREATE TRIGGER update_floor_drawings_updated_at
BEFORE UPDATE ON public.project_floor_drawings
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();