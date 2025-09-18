-- Create warehouse_locations table
CREATE TABLE public.warehouse_locations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('location', 'sublocation', 'department')),
  parent_id UUID REFERENCES public.warehouse_locations(id) ON DELETE CASCADE,
  description TEXT,
  company_id UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id)
);

-- Create warehouse_assets table
CREATE TABLE public.warehouse_assets (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  serial_number TEXT,
  asset_tag TEXT,
  location_id UUID REFERENCES public.warehouse_locations(id),
  sublocation_id UUID REFERENCES public.warehouse_locations(id),
  department_id UUID REFERENCES public.warehouse_locations(id),
  condition TEXT NOT NULL DEFAULT 'good' CHECK (condition IN ('good', 'fair', 'poor', 'needs_repair')),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'maintenance', 'disposed')),
  purchase_date DATE,
  purchase_price DECIMAL(15,2),
  current_value DECIMAL(15,2),
  description TEXT,
  notes TEXT,
  company_id UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id)
);

-- Enable Row Level Security
ALTER TABLE public.warehouse_locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.warehouse_assets ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for warehouse_locations
CREATE POLICY "Authenticated users can view warehouse locations" 
ON public.warehouse_locations 
FOR SELECT 
USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can create warehouse locations" 
ON public.warehouse_locations 
FOR INSERT 
WITH CHECK (auth.uid() IS NOT NULL AND auth.uid() = created_by);

CREATE POLICY "Users can update warehouse locations they created or admins can update any" 
ON public.warehouse_locations 
FOR UPDATE 
USING (auth.uid() = created_by OR is_admin(auth.uid()));

CREATE POLICY "Admins can delete warehouse locations" 
ON public.warehouse_locations 
FOR DELETE 
USING (is_admin(auth.uid()));

-- Create RLS policies for warehouse_assets
CREATE POLICY "Authenticated users can view warehouse assets" 
ON public.warehouse_assets 
FOR SELECT 
USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can create warehouse assets" 
ON public.warehouse_assets 
FOR INSERT 
WITH CHECK (auth.uid() IS NOT NULL AND auth.uid() = created_by);

CREATE POLICY "Users can update warehouse assets they created or admins can update any" 
ON public.warehouse_assets 
FOR UPDATE 
USING (auth.uid() = created_by OR is_admin(auth.uid()));

CREATE POLICY "Admins can delete warehouse assets" 
ON public.warehouse_assets 
FOR DELETE 
USING (is_admin(auth.uid()));

-- Create triggers for automatic timestamp updates
CREATE TRIGGER update_warehouse_locations_updated_at
BEFORE UPDATE ON public.warehouse_locations
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_warehouse_assets_updated_at
BEFORE UPDATE ON public.warehouse_assets
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create indexes for better performance
CREATE INDEX idx_warehouse_locations_parent_id ON public.warehouse_locations(parent_id);
CREATE INDEX idx_warehouse_locations_type ON public.warehouse_locations(type);
CREATE INDEX idx_warehouse_assets_location_id ON public.warehouse_assets(location_id);
CREATE INDEX idx_warehouse_assets_sublocation_id ON public.warehouse_assets(sublocation_id);
CREATE INDEX idx_warehouse_assets_department_id ON public.warehouse_assets(department_id);
CREATE INDEX idx_warehouse_assets_status ON public.warehouse_assets(status);