-- Create a dedicated table for tracking repair records
CREATE TABLE public.construction_repair_records (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID REFERENCES public.companies(id),
  item_id UUID NOT NULL REFERENCES public.construction_inventory_master(id) ON DELETE CASCADE,
  item_name TEXT NOT NULL,
  quantity NUMERIC(10,2) NOT NULL DEFAULT 1,
  unit TEXT,
  location_id UUID REFERENCES public.warehouse_locations(id),
  repair_status TEXT NOT NULL DEFAULT 'sent_for_repair' CHECK (repair_status IN ('sent_for_repair', 'in_repair', 'repaired', 'returned', 'discarded')),
  service_provider TEXT,
  remarks TEXT,
  sent_date TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  expected_return_date TIMESTAMP WITH TIME ZONE,
  actual_return_date TIMESTAMP WITH TIME ZONE,
  created_by UUID,
  updated_by UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.construction_repair_records ENABLE ROW LEVEL SECURITY;

-- Create policies for authenticated users
CREATE POLICY "Users can view repair records" 
ON public.construction_repair_records 
FOR SELECT 
TO authenticated
USING (true);

CREATE POLICY "Users can create repair records" 
ON public.construction_repair_records 
FOR INSERT 
TO authenticated
WITH CHECK (true);

CREATE POLICY "Users can update repair records" 
ON public.construction_repair_records 
FOR UPDATE 
TO authenticated
USING (true);

CREATE POLICY "Users can delete repair records" 
ON public.construction_repair_records 
FOR DELETE 
TO authenticated
USING (true);

-- Create indexes for performance
CREATE INDEX idx_construction_repair_records_company ON public.construction_repair_records(company_id);
CREATE INDEX idx_construction_repair_records_item ON public.construction_repair_records(item_id);
CREATE INDEX idx_construction_repair_records_status ON public.construction_repair_records(repair_status);
CREATE INDEX idx_construction_repair_records_location ON public.construction_repair_records(location_id);

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_construction_repair_records_updated_at
BEFORE UPDATE ON public.construction_repair_records
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();