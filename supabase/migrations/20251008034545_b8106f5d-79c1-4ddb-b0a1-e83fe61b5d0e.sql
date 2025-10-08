-- Create material_requests table
CREATE TABLE public.material_requests (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  request_number TEXT NOT NULL UNIQUE,
  request_date DATE NOT NULL DEFAULT CURRENT_DATE,
  requested_by TEXT NOT NULL,
  department TEXT,
  contact_number TEXT,
  epf_number TEXT,
  job_number TEXT,
  items_required_date DATE NOT NULL,
  purpose TEXT NOT NULL,
  priority TEXT NOT NULL DEFAULT 'medium',
  status TEXT NOT NULL DEFAULT 'draft',
  hod_approved_by UUID REFERENCES auth.users(id),
  hod_approval_date TIMESTAMP WITH TIME ZONE,
  hod_comments TEXT,
  management_approved_by UUID REFERENCES auth.users(id),
  management_approval_date TIMESTAMP WITH TIME ZONE,
  management_comments TEXT,
  rejection_reason TEXT,
  min_id UUID REFERENCES material_issue_notes(id),
  notes TEXT,
  company_id UUID,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create material_request_items table
CREATE TABLE public.material_request_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  request_id UUID NOT NULL REFERENCES material_requests(id) ON DELETE CASCADE,
  item_id UUID NOT NULL REFERENCES warehouse_items(id),
  line_number INTEGER,
  item_code TEXT,
  description TEXT,
  unit_of_measure TEXT NOT NULL DEFAULT 'pcs',
  quantity_requested NUMERIC NOT NULL,
  quantity_approved NUMERIC,
  purpose TEXT,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create function to generate MR number
CREATE OR REPLACE FUNCTION public.generate_mr_number()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  next_number INTEGER;
  new_mr_number TEXT;
BEGIN
  SELECT COALESCE(MAX(CAST(SUBSTRING(request_number FROM 'MR-' || TO_CHAR(CURRENT_DATE, 'YYYYMMDD') || '-(.*)') AS INTEGER)), 0) + 1
  INTO next_number
  FROM material_requests
  WHERE request_number LIKE 'MR-' || TO_CHAR(CURRENT_DATE, 'YYYYMMDD') || '-%';
  
  new_mr_number := 'MR-' || TO_CHAR(CURRENT_DATE, 'YYYYMMDD') || '-' || LPAD(next_number::TEXT, 3, '0');
  RETURN new_mr_number;
END;
$$;

-- Auto-generate MR number trigger
CREATE OR REPLACE FUNCTION public.auto_generate_mr_number()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.request_number IS NULL OR NEW.request_number = '' THEN
    NEW.request_number := generate_mr_number();
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER auto_generate_mr_number_trigger
BEFORE INSERT ON public.material_requests
FOR EACH ROW
EXECUTE FUNCTION public.auto_generate_mr_number();

-- Add request_id to material_issue_notes
ALTER TABLE public.material_issue_notes
ADD COLUMN request_id UUID REFERENCES material_requests(id);

-- Enable RLS on material_requests
ALTER TABLE public.material_requests ENABLE ROW LEVEL SECURITY;

-- RLS Policies for material_requests
CREATE POLICY "Authenticated users can view material requests"
ON public.material_requests
FOR SELECT
USING (auth.uid() IS NOT NULL);

CREATE POLICY "Users can create material requests"
ON public.material_requests
FOR INSERT
WITH CHECK (auth.uid() IS NOT NULL AND auth.uid() = created_by);

CREATE POLICY "Users can update their own draft requests or admins can update any"
ON public.material_requests
FOR UPDATE
USING ((auth.uid() = created_by AND status = 'draft') OR is_admin(auth.uid()));

CREATE POLICY "Admins can delete material requests"
ON public.material_requests
FOR DELETE
USING (is_admin(auth.uid()));

-- Enable RLS on material_request_items
ALTER TABLE public.material_request_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view request items they have access to"
ON public.material_request_items
FOR SELECT
USING (EXISTS (
  SELECT 1 FROM material_requests mr
  WHERE mr.id = material_request_items.request_id
  AND (mr.created_by = auth.uid() OR is_admin(auth.uid()))
));

CREATE POLICY "Users can manage items for their own draft requests"
ON public.material_request_items
FOR ALL
USING (EXISTS (
  SELECT 1 FROM material_requests mr
  WHERE mr.id = material_request_items.request_id
  AND ((mr.created_by = auth.uid() AND mr.status = 'draft') OR is_admin(auth.uid()))
));