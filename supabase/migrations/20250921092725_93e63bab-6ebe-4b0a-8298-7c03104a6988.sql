-- Create item categories table
CREATE TABLE public.item_categories (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  code TEXT,
  parent_id UUID REFERENCES public.item_categories(id) ON DELETE SET NULL,
  description TEXT,
  company_id UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by UUID
);

-- Create item units table
CREATE TABLE public.item_units (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  abbreviation TEXT NOT NULL,
  description TEXT,
  company_id UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by UUID
);

-- Create bin types table
CREATE TABLE public.bin_types (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  company_id UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by UUID
);

-- Create warehouse bins table
CREATE TABLE public.warehouse_bins (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  bin_code TEXT NOT NULL,
  name TEXT NOT NULL,
  bin_type_id UUID REFERENCES public.bin_types(id),
  location_id UUID REFERENCES public.warehouse_locations(id),
  capacity NUMERIC,
  current_quantity NUMERIC DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'maintenance', 'full')),
  description TEXT,
  notes TEXT,
  company_id UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by UUID,
  UNIQUE(bin_code, company_id)
);

-- Create warehouse items table
CREATE TABLE public.warehouse_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  item_code TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  category_id UUID REFERENCES public.item_categories(id),
  unit_id UUID REFERENCES public.item_units(id),
  reorder_level NUMERIC,
  max_stock_level NUMERIC,
  min_stock_level NUMERIC,
  current_stock NUMERIC DEFAULT 0,
  unit_cost NUMERIC,
  selling_price NUMERIC,
  barcode TEXT,
  sku TEXT,
  brand TEXT,
  manufacturer TEXT,
  supplier_id UUID REFERENCES public.suppliers(id),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'discontinued')),
  is_serialized BOOLEAN DEFAULT false,
  is_batch_tracked BOOLEAN DEFAULT false,
  notes TEXT,
  company_id UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by UUID,
  UNIQUE(item_code, company_id),
  UNIQUE(sku, company_id)
);

-- Enable RLS on all tables
ALTER TABLE public.item_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.item_units ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bin_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.warehouse_bins ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.warehouse_items ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for item_categories
CREATE POLICY "Authenticated users can view item categories" ON public.item_categories
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can create item categories" ON public.item_categories
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL AND auth.uid() = created_by);

CREATE POLICY "Users can update categories they created or admins can update any" ON public.item_categories
  FOR UPDATE USING (auth.uid() = created_by OR is_admin(auth.uid()));

CREATE POLICY "Admins can delete item categories" ON public.item_categories
  FOR DELETE USING (is_admin(auth.uid()));

-- Create RLS policies for item_units
CREATE POLICY "Authenticated users can view item units" ON public.item_units
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can create item units" ON public.item_units
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL AND auth.uid() = created_by);

CREATE POLICY "Users can update units they created or admins can update any" ON public.item_units
  FOR UPDATE USING (auth.uid() = created_by OR is_admin(auth.uid()));

CREATE POLICY "Admins can delete item units" ON public.item_units
  FOR DELETE USING (is_admin(auth.uid()));

-- Create RLS policies for bin_types
CREATE POLICY "Authenticated users can view bin types" ON public.bin_types
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can create bin types" ON public.bin_types
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL AND auth.uid() = created_by);

CREATE POLICY "Users can update bin types they created or admins can update any" ON public.bin_types
  FOR UPDATE USING (auth.uid() = created_by OR is_admin(auth.uid()));

CREATE POLICY "Admins can delete bin types" ON public.bin_types
  FOR DELETE USING (is_admin(auth.uid()));

-- Create RLS policies for warehouse_bins
CREATE POLICY "Authenticated users can view warehouse bins" ON public.warehouse_bins
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can create warehouse bins" ON public.warehouse_bins
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL AND auth.uid() = created_by);

CREATE POLICY "Users can update bins they created or admins can update any" ON public.warehouse_bins
  FOR UPDATE USING (auth.uid() = created_by OR is_admin(auth.uid()));

CREATE POLICY "Admins can delete warehouse bins" ON public.warehouse_bins
  FOR DELETE USING (is_admin(auth.uid()));

-- Create RLS policies for warehouse_items
CREATE POLICY "Authenticated users can view warehouse items" ON public.warehouse_items
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can create warehouse items" ON public.warehouse_items
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL AND auth.uid() = created_by);

CREATE POLICY "Users can update items they created or admins can update any" ON public.warehouse_items
  FOR UPDATE USING (auth.uid() = created_by OR is_admin(auth.uid()));

CREATE POLICY "Admins can delete warehouse items" ON public.warehouse_items
  FOR DELETE USING (is_admin(auth.uid()));

-- Create triggers for updated_at columns
CREATE TRIGGER update_item_categories_updated_at
  BEFORE UPDATE ON public.item_categories
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_item_units_updated_at
  BEFORE UPDATE ON public.item_units
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_bin_types_updated_at
  BEFORE UPDATE ON public.bin_types
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_warehouse_bins_updated_at
  BEFORE UPDATE ON public.warehouse_bins
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_warehouse_items_updated_at
  BEFORE UPDATE ON public.warehouse_items
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Create indexes for better performance
CREATE INDEX idx_item_categories_parent_id ON public.item_categories(parent_id);
CREATE INDEX idx_item_categories_company_id ON public.item_categories(company_id);
CREATE INDEX idx_warehouse_bins_location_id ON public.warehouse_bins(location_id);
CREATE INDEX idx_warehouse_bins_company_id ON public.warehouse_bins(company_id);
CREATE INDEX idx_warehouse_items_category_id ON public.warehouse_items(category_id);
CREATE INDEX idx_warehouse_items_company_id ON public.warehouse_items(company_id);
CREATE INDEX idx_warehouse_items_supplier_id ON public.warehouse_items(supplier_id);