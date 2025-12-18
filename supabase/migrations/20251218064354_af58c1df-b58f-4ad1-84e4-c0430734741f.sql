-- Construction Projects Table
CREATE TABLE public.construction_projects (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID REFERENCES public.companies(id),
  project_code TEXT NOT NULL,
  project_name TEXT NOT NULL,
  description TEXT,
  client_name TEXT,
  client_contact TEXT,
  project_type TEXT, -- residential, commercial, industrial, infrastructure
  status TEXT NOT NULL DEFAULT 'planning', -- planning, active, on_hold, completed, cancelled
  start_date DATE,
  target_end_date DATE,
  actual_end_date DATE,
  estimated_budget NUMERIC(15,2),
  actual_cost NUMERIC(15,2) DEFAULT 0,
  project_manager_id UUID,
  address TEXT,
  city TEXT,
  state TEXT,
  country TEXT,
  latitude NUMERIC(10,7),
  longitude NUMERIC(10,7),
  contract_number TEXT,
  contract_value NUMERIC(15,2),
  completion_percentage NUMERIC(5,2) DEFAULT 0,
  notes TEXT,
  created_by UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Project Sites Table
CREATE TABLE public.project_sites (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES public.construction_projects(id) ON DELETE CASCADE,
  site_code TEXT NOT NULL,
  site_name TEXT NOT NULL,
  description TEXT,
  address TEXT,
  city TEXT,
  state TEXT,
  country TEXT,
  latitude NUMERIC(10,7),
  longitude NUMERIC(10,7),
  site_manager_id UUID,
  status TEXT NOT NULL DEFAULT 'active', -- active, inactive, completed
  area_sqft NUMERIC(12,2),
  notes TEXT,
  created_by UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Project Team Members Table
CREATE TABLE public.project_team_members (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES public.construction_projects(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  role TEXT NOT NULL, -- project_manager, site_engineer, supervisor, safety_officer, quality_inspector
  start_date DATE,
  end_date DATE,
  is_active BOOLEAN DEFAULT true,
  notes TEXT,
  created_by UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(project_id, user_id, role)
);

-- Project Phases Table
CREATE TABLE public.project_phases (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES public.construction_projects(id) ON DELETE CASCADE,
  phase_number INTEGER NOT NULL,
  phase_name TEXT NOT NULL,
  description TEXT,
  planned_start_date DATE,
  planned_end_date DATE,
  actual_start_date DATE,
  actual_end_date DATE,
  status TEXT NOT NULL DEFAULT 'pending', -- pending, in_progress, completed, delayed
  completion_percentage NUMERIC(5,2) DEFAULT 0,
  budget_allocated NUMERIC(15,2),
  actual_cost NUMERIC(15,2) DEFAULT 0,
  notes TEXT,
  created_by UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(project_id, phase_number)
);

-- Create indexes
CREATE INDEX idx_construction_projects_company ON public.construction_projects(company_id);
CREATE INDEX idx_construction_projects_status ON public.construction_projects(status);
CREATE INDEX idx_project_sites_project ON public.project_sites(project_id);
CREATE INDEX idx_project_team_project ON public.project_team_members(project_id);
CREATE INDEX idx_project_phases_project ON public.project_phases(project_id);

-- Enable RLS
ALTER TABLE public.construction_projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_sites ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_team_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_phases ENABLE ROW LEVEL SECURITY;

-- RLS Policies for construction_projects
CREATE POLICY "Users can view projects in their company" ON public.construction_projects
  FOR SELECT USING (
    company_id IN (SELECT company_id FROM public.profiles WHERE user_id = auth.uid())
    OR public.is_admin(auth.uid())
  );

CREATE POLICY "Users can create projects in their company" ON public.construction_projects
  FOR INSERT WITH CHECK (
    company_id IN (SELECT company_id FROM public.profiles WHERE user_id = auth.uid())
    OR public.is_admin(auth.uid())
  );

CREATE POLICY "Users can update projects in their company" ON public.construction_projects
  FOR UPDATE USING (
    company_id IN (SELECT company_id FROM public.profiles WHERE user_id = auth.uid())
    OR public.is_admin(auth.uid())
  );

CREATE POLICY "Users can delete projects in their company" ON public.construction_projects
  FOR DELETE USING (
    company_id IN (SELECT company_id FROM public.profiles WHERE user_id = auth.uid())
    OR public.is_admin(auth.uid())
  );

-- RLS Policies for project_sites
CREATE POLICY "Users can view sites for accessible projects" ON public.project_sites
  FOR SELECT USING (
    project_id IN (SELECT id FROM public.construction_projects WHERE company_id IN (SELECT company_id FROM public.profiles WHERE user_id = auth.uid()))
    OR public.is_admin(auth.uid())
  );

CREATE POLICY "Users can manage sites for accessible projects" ON public.project_sites
  FOR ALL USING (
    project_id IN (SELECT id FROM public.construction_projects WHERE company_id IN (SELECT company_id FROM public.profiles WHERE user_id = auth.uid()))
    OR public.is_admin(auth.uid())
  );

-- RLS Policies for project_team_members
CREATE POLICY "Users can view team for accessible projects" ON public.project_team_members
  FOR SELECT USING (
    project_id IN (SELECT id FROM public.construction_projects WHERE company_id IN (SELECT company_id FROM public.profiles WHERE user_id = auth.uid()))
    OR public.is_admin(auth.uid())
  );

CREATE POLICY "Users can manage team for accessible projects" ON public.project_team_members
  FOR ALL USING (
    project_id IN (SELECT id FROM public.construction_projects WHERE company_id IN (SELECT company_id FROM public.profiles WHERE user_id = auth.uid()))
    OR public.is_admin(auth.uid())
  );

-- RLS Policies for project_phases
CREATE POLICY "Users can view phases for accessible projects" ON public.project_phases
  FOR SELECT USING (
    project_id IN (SELECT id FROM public.construction_projects WHERE company_id IN (SELECT company_id FROM public.profiles WHERE user_id = auth.uid()))
    OR public.is_admin(auth.uid())
  );

CREATE POLICY "Users can manage phases for accessible projects" ON public.project_phases
  FOR ALL USING (
    project_id IN (SELECT id FROM public.construction_projects WHERE company_id IN (SELECT company_id FROM public.profiles WHERE user_id = auth.uid()))
    OR public.is_admin(auth.uid())
  );

-- Auto-generate project code function
CREATE OR REPLACE FUNCTION public.generate_project_code()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  next_number INTEGER;
  new_code TEXT;
BEGIN
  SELECT COALESCE(MAX(CAST(SUBSTRING(project_code FROM 'PRJ-' || TO_CHAR(CURRENT_DATE, 'YYYYMM') || '-(.*)') AS INTEGER)), 0) + 1
  INTO next_number
  FROM construction_projects
  WHERE project_code LIKE 'PRJ-' || TO_CHAR(CURRENT_DATE, 'YYYYMM') || '-%';
  
  new_code := 'PRJ-' || TO_CHAR(CURRENT_DATE, 'YYYYMM') || '-' || LPAD(next_number::TEXT, 3, '0');
  RETURN new_code;
END;
$$;

-- Trigger to auto-generate project code
CREATE OR REPLACE FUNCTION public.auto_generate_project_code()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.project_code IS NULL OR NEW.project_code = '' THEN
    NEW.project_code := generate_project_code();
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_auto_generate_project_code
  BEFORE INSERT ON public.construction_projects
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_generate_project_code();

-- Updated_at triggers
CREATE TRIGGER update_construction_projects_updated_at
  BEFORE UPDATE ON public.construction_projects
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_project_sites_updated_at
  BEFORE UPDATE ON public.project_sites
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_project_team_updated_at
  BEFORE UPDATE ON public.project_team_members
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_project_phases_updated_at
  BEFORE UPDATE ON public.project_phases
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();