-- Construction Labour Master Table
CREATE TABLE public.construction_labour_master (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID REFERENCES public.companies(id),
  name TEXT NOT NULL,
  trade TEXT,
  skill_level TEXT,
  contact_number TEXT,
  email TEXT,
  hourly_rate NUMERIC(10,2),
  daily_rate NUMERIC(10,2),
  status TEXT NOT NULL DEFAULT 'active',
  notes TEXT,
  created_by UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Construction Inventory Master Table
CREATE TABLE public.construction_inventory_master (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID REFERENCES public.companies(id),
  item_code TEXT,
  item_name TEXT NOT NULL,
  category TEXT,
  unit TEXT,
  unit_cost NUMERIC(10,2),
  description TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  notes TEXT,
  created_by UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Construction Subcontractor Master Table
CREATE TABLE public.construction_subcontractor_master (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID REFERENCES public.companies(id),
  name TEXT NOT NULL,
  trade TEXT,
  contact_person TEXT,
  phone TEXT,
  email TEXT,
  address TEXT,
  license_number TEXT,
  insurance_expiry DATE,
  status TEXT NOT NULL DEFAULT 'pending',
  notes TEXT,
  created_by UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on all tables
ALTER TABLE public.construction_labour_master ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.construction_inventory_master ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.construction_subcontractor_master ENABLE ROW LEVEL SECURITY;

-- RLS Policies for construction_labour_master (allow authenticated users)
CREATE POLICY "Authenticated users can view labour master"
ON public.construction_labour_master FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can insert labour master"
ON public.construction_labour_master FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated users can update labour master"
ON public.construction_labour_master FOR UPDATE TO authenticated USING (true);

CREATE POLICY "Authenticated users can delete labour master"
ON public.construction_labour_master FOR DELETE TO authenticated USING (true);

-- RLS Policies for construction_inventory_master
CREATE POLICY "Authenticated users can view inventory master"
ON public.construction_inventory_master FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can insert inventory master"
ON public.construction_inventory_master FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated users can update inventory master"
ON public.construction_inventory_master FOR UPDATE TO authenticated USING (true);

CREATE POLICY "Authenticated users can delete inventory master"
ON public.construction_inventory_master FOR DELETE TO authenticated USING (true);

-- RLS Policies for construction_subcontractor_master
CREATE POLICY "Authenticated users can view subcontractor master"
ON public.construction_subcontractor_master FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can insert subcontractor master"
ON public.construction_subcontractor_master FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated users can update subcontractor master"
ON public.construction_subcontractor_master FOR UPDATE TO authenticated USING (true);

CREATE POLICY "Authenticated users can delete subcontractor master"
ON public.construction_subcontractor_master FOR DELETE TO authenticated USING (true);