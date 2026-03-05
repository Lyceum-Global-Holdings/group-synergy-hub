
-- Add location_id to construction_projects
ALTER TABLE public.construction_projects
  ADD COLUMN IF NOT EXISTS location_id uuid REFERENCES public.warehouse_locations(id);

-- Create junction table for multi-company project associations
CREATE TABLE IF NOT EXISTS public.construction_project_companies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.construction_projects(id) ON DELETE CASCADE,
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(project_id, company_id)
);

-- Enable RLS
ALTER TABLE public.construction_project_companies ENABLE ROW LEVEL SECURITY;

-- RLS policy: authenticated users with company access can view
CREATE POLICY "Users can view project company mappings they have access to"
  ON public.construction_project_companies
  FOR SELECT
  TO authenticated
  USING (public.can_access_company(company_id));

-- RLS policy: users with construction access can manage
CREATE POLICY "Construction users can manage project company mappings"
  ON public.construction_project_companies
  FOR ALL
  TO authenticated
  USING (public.can_access_company(company_id))
  WITH CHECK (public.can_access_company(company_id));

-- Migrate existing company_id data into junction table
INSERT INTO public.construction_project_companies (project_id, company_id)
SELECT id, company_id FROM public.construction_projects
WHERE company_id IS NOT NULL
ON CONFLICT (project_id, company_id) DO NOTHING;
