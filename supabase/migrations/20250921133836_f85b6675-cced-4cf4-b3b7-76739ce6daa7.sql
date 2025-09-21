-- Add sample company and BOM tables
INSERT INTO companies (name, code, address, status, modules) 
VALUES (
  'The Uniform Hub', 
  'TUH', 
  '123 Business Street, Commerce City, NY 10001', 
  'active',
  ARRAY['warehouse', 'procurement', 'sourcing', 'management']
) ON CONFLICT DO NOTHING;

-- Create BOM (Bill of Materials) table
CREATE TABLE IF NOT EXISTS public.bill_of_materials (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  bom_number TEXT NOT NULL UNIQUE,
  po_id UUID REFERENCES purchase_orders(id) ON DELETE CASCADE,
  company_id UUID REFERENCES companies(id) ON DELETE SET NULL,
  product_name TEXT NOT NULL,
  description TEXT,
  version TEXT DEFAULT '1.0',
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'draft')),
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create BOM items table
CREATE TABLE IF NOT EXISTS public.bom_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  bom_id UUID NOT NULL REFERENCES bill_of_materials(id) ON DELETE CASCADE,
  po_item_id UUID REFERENCES po_items(id) ON DELETE SET NULL,
  item_name TEXT NOT NULL,
  description TEXT,
  quantity NUMERIC(10,3) NOT NULL,
  unit_of_measure TEXT NOT NULL DEFAULT 'pcs',
  unit_cost NUMERIC(15,2),
  total_cost NUMERIC(15,2),
  supplier_part_number TEXT,
  manufacturer_part_number TEXT,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Add RLS policies for BOM tables
ALTER TABLE public.bill_of_materials ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bom_items ENABLE ROW LEVEL SECURITY;

-- BOM policies
CREATE POLICY "Authenticated users can view BOMs" 
ON public.bill_of_materials 
FOR SELECT 
USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can create BOMs" 
ON public.bill_of_materials 
FOR INSERT 
WITH CHECK (auth.uid() IS NOT NULL AND auth.uid() = created_by);

CREATE POLICY "Users can update BOMs they created or admins can update any" 
ON public.bill_of_materials 
FOR UPDATE 
USING ((auth.uid() = created_by) OR is_admin(auth.uid()));

CREATE POLICY "Admins can delete BOMs" 
ON public.bill_of_materials 
FOR DELETE 
USING (is_admin(auth.uid()));

-- BOM items policies
CREATE POLICY "Authenticated users can view BOM items" 
ON public.bom_items 
FOR SELECT 
USING (auth.uid() IS NOT NULL);

CREATE POLICY "Users can manage BOM items for BOMs they have access to" 
ON public.bom_items 
FOR ALL 
USING (EXISTS (
  SELECT 1 FROM bill_of_materials bom 
  WHERE bom.id = bom_items.bom_id 
  AND ((bom.created_by = auth.uid()) OR is_admin(auth.uid()))
));

-- Add company_id to PR and PO tables if not exists
ALTER TABLE purchase_requisitions 
ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES companies(id) ON DELETE SET NULL;

ALTER TABLE purchase_orders 
ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES companies(id) ON DELETE SET NULL;

-- Add triggers for updated_at
CREATE TRIGGER update_bom_updated_at
  BEFORE UPDATE ON public.bill_of_materials
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_bom_items_updated_at
  BEFORE UPDATE ON public.bom_items
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Generate BOM number function
CREATE OR REPLACE FUNCTION public.generate_bom_number()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  next_number INTEGER;
  new_bom_number TEXT;
BEGIN
  -- Get the next sequence number for today
  SELECT COALESCE(MAX(CAST(SUBSTRING(bom_number FROM 'BOM-' || TO_CHAR(CURRENT_DATE, 'YYYYMMDD') || '-(.*)') AS INTEGER)), 0) + 1
  INTO next_number
  FROM bill_of_materials
  WHERE bom_number LIKE 'BOM-' || TO_CHAR(CURRENT_DATE, 'YYYYMMDD') || '-%';
  
  -- Generate BOM number: BOM-YYYYMMDD-001
  new_bom_number := 'BOM-' || TO_CHAR(CURRENT_DATE, 'YYYYMMDD') || '-' || LPAD(next_number::TEXT, 3, '0');
  
  RETURN new_bom_number;
END;
$$;