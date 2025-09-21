-- Create material issue notes table
CREATE TABLE public.material_issue_notes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  min_number TEXT NOT NULL UNIQUE,
  issue_date DATE NOT NULL DEFAULT CURRENT_DATE,
  issued_to TEXT NOT NULL,
  department TEXT,
  purpose TEXT,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'approved', 'issued', 'cancelled')),
  total_value NUMERIC(15,2) DEFAULT 0,
  notes TEXT,
  company_id UUID,
  created_by UUID,
  approved_by UUID,
  approved_date TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create material issue items table  
CREATE TABLE public.material_issue_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  min_id UUID NOT NULL REFERENCES public.material_issue_notes(id) ON DELETE CASCADE,
  item_id UUID NOT NULL REFERENCES public.warehouse_items(id) ON DELETE RESTRICT,
  quantity_issued NUMERIC NOT NULL CHECK (quantity_issued > 0),
  unit_cost NUMERIC(15,2),
  total_cost NUMERIC(15,2),
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create material return notes table
CREATE TABLE public.material_return_notes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  mrn_number TEXT NOT NULL UNIQUE,
  return_date DATE NOT NULL DEFAULT CURRENT_DATE,
  returned_by TEXT NOT NULL,
  return_type TEXT NOT NULL DEFAULT 'internal' CHECK (return_type IN ('internal', 'supplier')),
  reason TEXT NOT NULL,
  reference_type TEXT CHECK (reference_type IN ('material_issue', 'purchase_order', 'other')),
  reference_id UUID,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'approved', 'returned', 'cancelled')),
  total_value NUMERIC(15,2) DEFAULT 0,
  notes TEXT,
  company_id UUID,
  created_by UUID,
  approved_by UUID,
  approved_date TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create material return items table
CREATE TABLE public.material_return_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  mrn_id UUID NOT NULL REFERENCES public.material_return_notes(id) ON DELETE CASCADE,
  item_id UUID NOT NULL REFERENCES public.warehouse_items(id) ON DELETE RESTRICT,
  quantity_returned NUMERIC NOT NULL CHECK (quantity_returned > 0),
  unit_cost NUMERIC(15,2),
  total_cost NUMERIC(15,2),
  condition TEXT DEFAULT 'good' CHECK (condition IN ('good', 'damaged', 'expired')),
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.material_issue_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.material_issue_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.material_return_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.material_return_items ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for material_issue_notes
CREATE POLICY "Authenticated users can view material issue notes" 
ON public.material_issue_notes FOR SELECT 
USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can create material issue notes" 
ON public.material_issue_notes FOR INSERT 
WITH CHECK (auth.uid() IS NOT NULL AND auth.uid() = created_by);

CREATE POLICY "Users can update their own draft material issues or admins can update any" 
ON public.material_issue_notes FOR UPDATE 
USING ((auth.uid() = created_by AND status = 'draft') OR is_admin(auth.uid()));

CREATE POLICY "Admins can delete material issue notes" 
ON public.material_issue_notes FOR DELETE 
USING (is_admin(auth.uid()));

-- Create RLS policies for material_issue_items
CREATE POLICY "Users can view material issue items they have access to" 
ON public.material_issue_items FOR SELECT 
USING (EXISTS (
  SELECT 1 FROM public.material_issue_notes min 
  WHERE min.id = material_issue_items.min_id 
  AND (min.created_by = auth.uid() OR is_admin(auth.uid()))
));

CREATE POLICY "Users can manage items for their own material issues" 
ON public.material_issue_items FOR ALL 
USING (EXISTS (
  SELECT 1 FROM public.material_issue_notes min 
  WHERE min.id = material_issue_items.min_id 
  AND ((min.created_by = auth.uid() AND min.status = 'draft') OR is_admin(auth.uid()))
));

-- Create RLS policies for material_return_notes
CREATE POLICY "Authenticated users can view material return notes" 
ON public.material_return_notes FOR SELECT 
USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can create material return notes" 
ON public.material_return_notes FOR INSERT 
WITH CHECK (auth.uid() IS NOT NULL AND auth.uid() = created_by);

CREATE POLICY "Users can update their own draft material returns or admins can update any" 
ON public.material_return_notes FOR UPDATE 
USING ((auth.uid() = created_by AND status = 'draft') OR is_admin(auth.uid()));

CREATE POLICY "Admins can delete material return notes" 
ON public.material_return_notes FOR DELETE 
USING (is_admin(auth.uid()));

-- Create RLS policies for material_return_items
CREATE POLICY "Users can view material return items they have access to" 
ON public.material_return_items FOR SELECT 
USING (EXISTS (
  SELECT 1 FROM public.material_return_notes mrn 
  WHERE mrn.id = material_return_items.mrn_id 
  AND (mrn.created_by = auth.uid() OR is_admin(auth.uid()))
));

CREATE POLICY "Users can manage items for their own material returns" 
ON public.material_return_items FOR ALL 
USING (EXISTS (
  SELECT 1 FROM public.material_return_notes mrn 
  WHERE mrn.id = material_return_items.mrn_id 
  AND ((mrn.created_by = auth.uid() AND mrn.status = 'draft') OR is_admin(auth.uid()))
));

-- Create auto number generation functions
CREATE OR REPLACE FUNCTION public.generate_min_number()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  next_number INTEGER;
  new_min_number TEXT;
BEGIN
  -- Get the next sequence number for today
  SELECT COALESCE(MAX(CAST(SUBSTRING(min_number FROM 'MIN-' || TO_CHAR(CURRENT_DATE, 'YYYYMMDD') || '-(.*)') AS INTEGER)), 0) + 1
  INTO next_number
  FROM material_issue_notes
  WHERE min_number LIKE 'MIN-' || TO_CHAR(CURRENT_DATE, 'YYYYMMDD') || '-%';
  
  -- Generate MIN number: MIN-YYYYMMDD-001
  new_min_number := 'MIN-' || TO_CHAR(CURRENT_DATE, 'YYYYMMDD') || '-' || LPAD(next_number::TEXT, 3, '0');
  
  RETURN new_min_number;
END;
$$;

CREATE OR REPLACE FUNCTION public.generate_mrn_number()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  next_number INTEGER;
  new_mrn_number TEXT;
BEGIN
  -- Get the next sequence number for today
  SELECT COALESCE(MAX(CAST(SUBSTRING(mrn_number FROM 'MRN-' || TO_CHAR(CURRENT_DATE, 'YYYYMMDD') || '-(.*)') AS INTEGER)), 0) + 1
  INTO next_number
  FROM material_return_notes
  WHERE mrn_number LIKE 'MRN-' || TO_CHAR(CURRENT_DATE, 'YYYYMMDD') || '-%';
  
  -- Generate MRN number: MRN-YYYYMMDD-001
  new_mrn_number := 'MRN-' || TO_CHAR(CURRENT_DATE, 'YYYYMMDD') || '-' || LPAD(next_number::TEXT, 3, '0');
  
  RETURN new_mrn_number;
END;
$$;

-- Add triggers for updated_at
CREATE TRIGGER update_material_issue_notes_updated_at
  BEFORE UPDATE ON public.material_issue_notes
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_material_issue_items_updated_at
  BEFORE UPDATE ON public.material_issue_items
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_material_return_notes_updated_at
  BEFORE UPDATE ON public.material_return_notes
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_material_return_items_updated_at
  BEFORE UPDATE ON public.material_return_items
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();