-- Create asset_categories table for hierarchical categories
CREATE TABLE public.asset_categories (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  parent_id UUID REFERENCES public.asset_categories(id) ON DELETE CASCADE,
  description TEXT,
  company_id UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by UUID
);

-- Enable RLS
ALTER TABLE public.asset_categories ENABLE ROW LEVEL SECURITY;

-- Create policies for asset_categories
CREATE POLICY "Authenticated users can view asset categories" 
ON public.asset_categories 
FOR SELECT 
USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can create asset categories" 
ON public.asset_categories 
FOR INSERT 
WITH CHECK ((auth.uid() IS NOT NULL) AND (auth.uid() = created_by));

CREATE POLICY "Users can update asset categories they created or admins can update any" 
ON public.asset_categories 
FOR UPDATE 
USING ((auth.uid() = created_by) OR is_admin(auth.uid()));

CREATE POLICY "Admins can delete asset categories" 
ON public.asset_categories 
FOR DELETE 
USING (is_admin(auth.uid()));

-- Add trigger for automatic timestamp updates
CREATE TRIGGER update_asset_categories_updated_at
BEFORE UPDATE ON public.asset_categories
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Add indexes for performance
CREATE INDEX idx_asset_categories_parent_id ON public.asset_categories(parent_id);
CREATE INDEX idx_asset_categories_company_id ON public.asset_categories(company_id);

-- Add new columns to warehouse_assets
ALTER TABLE public.warehouse_assets 
ADD COLUMN category_id UUID REFERENCES public.asset_categories(id),
ADD COLUMN subcategory_id UUID REFERENCES public.asset_categories(id);

-- Create some default categories with subcategories
INSERT INTO public.asset_categories (name, description) VALUES 
('IT Equipment', 'Information Technology hardware and software'),
('Furniture', 'Office and warehouse furniture'),
('Machinery', 'Industrial and manufacturing equipment'),
('Vehicles', 'Transportation and logistics vehicles'),
('Tools', 'Hand tools and power tools');

-- Get the category IDs for subcategories
DO $$
DECLARE
    it_id UUID;
    furniture_id UUID;
    machinery_id UUID;
    vehicles_id UUID;
    tools_id UUID;
BEGIN
    -- Get parent category IDs
    SELECT id INTO it_id FROM public.asset_categories WHERE name = 'IT Equipment';
    SELECT id INTO furniture_id FROM public.asset_categories WHERE name = 'Furniture';
    SELECT id INTO machinery_id FROM public.asset_categories WHERE name = 'Machinery';
    SELECT id INTO vehicles_id FROM public.asset_categories WHERE name = 'Vehicles';
    SELECT id INTO tools_id FROM public.asset_categories WHERE name = 'Tools';
    
    -- Insert subcategories
    INSERT INTO public.asset_categories (name, parent_id) VALUES 
    ('Computers', it_id),
    ('Monitors', it_id),
    ('Printers', it_id),
    ('Networking', it_id),
    
    ('Desks', furniture_id),
    ('Chairs', furniture_id),
    ('Storage', furniture_id),
    
    ('Manufacturing', machinery_id),
    ('Packaging', machinery_id),
    ('Material Handling', machinery_id),
    
    ('Forklifts', vehicles_id),
    ('Trucks', vehicles_id),
    ('Carts', vehicles_id),
    
    ('Hand Tools', tools_id),
    ('Power Tools', tools_id),
    ('Measuring', tools_id);
END $$;