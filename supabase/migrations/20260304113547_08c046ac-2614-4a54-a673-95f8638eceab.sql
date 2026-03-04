
-- Junction table for warehouse locations having multiple companies
CREATE TABLE public.warehouse_location_companies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id UUID NOT NULL REFERENCES public.warehouse_locations(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(location_id, company_id)
);

-- Enable RLS
ALTER TABLE public.warehouse_location_companies ENABLE ROW LEVEL SECURITY;

-- RLS policy: authenticated users can read
CREATE POLICY "Authenticated users can read location companies"
  ON public.warehouse_location_companies
  FOR SELECT TO authenticated
  USING (true);

-- RLS policy: authenticated users can insert/update/delete
CREATE POLICY "Authenticated users can manage location companies"
  ON public.warehouse_location_companies
  FOR ALL TO authenticated
  USING (true)
  WITH CHECK (true);

-- Migrate existing company_id data into the junction table
INSERT INTO public.warehouse_location_companies (location_id, company_id)
SELECT id, company_id FROM public.warehouse_locations
WHERE company_id IS NOT NULL
ON CONFLICT (location_id, company_id) DO NOTHING;
