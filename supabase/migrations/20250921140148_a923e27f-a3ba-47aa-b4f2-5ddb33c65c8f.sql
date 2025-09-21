-- Add sample "The Uniform Hub" company with modules if not exists
INSERT INTO companies (name, code, address, status, modules) 
VALUES ('The Uniform Hub', 'TUH', 'Kurunegala', 'active', 
  ARRAY['finance', 'warehouse', 'sourcing', 'procurement', 'management', 'bom'])
ON CONFLICT (code) DO UPDATE SET 
  modules = ARRAY['finance', 'warehouse', 'sourcing', 'procurement', 'management', 'bom'];

-- Update existing companies with default modules
UPDATE companies 
SET modules = ARRAY['finance', 'warehouse', 'sourcing', 'procurement', 'management']
WHERE modules = '{}' OR modules IS NULL;

-- Create Bill of Materials table
CREATE TABLE IF NOT EXISTS bill_of_materials (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  bom_number TEXT NOT NULL DEFAULT generate_bom_number(),
  product_name TEXT NOT NULL,
  version TEXT DEFAULT '1.0',
  description TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'draft')),
  po_id UUID REFERENCES purchase_orders(id),
  company_id UUID REFERENCES companies(id),
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create BOM Items table
CREATE TABLE IF NOT EXISTS bom_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  bom_id UUID NOT NULL REFERENCES bill_of_materials(id) ON DELETE CASCADE,
  item_name TEXT NOT NULL,
  description TEXT,
  quantity NUMERIC NOT NULL,
  unit_of_measure TEXT NOT NULL DEFAULT 'pcs',
  unit_cost NUMERIC,
  total_cost NUMERIC,
  supplier_part_number TEXT,
  manufacturer_part_number TEXT,
  po_item_id UUID REFERENCES po_items(id),
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create function to generate BOM numbers
CREATE OR REPLACE FUNCTION generate_bom_number()
RETURNS TEXT AS $$
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
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Add company_id to purchase_requisitions and purchase_orders if not exists
ALTER TABLE purchase_requisitions 
ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES companies(id);

ALTER TABLE purchase_orders 
ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES companies(id);

-- Enable RLS for BOM tables
ALTER TABLE bill_of_materials ENABLE ROW LEVEL SECURITY;
ALTER TABLE bom_items ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for bill_of_materials
CREATE POLICY "Authenticated users can view BOMs" ON bill_of_materials
FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can create BOMs" ON bill_of_materials
FOR INSERT WITH CHECK (auth.uid() IS NOT NULL AND auth.uid() = created_by);

CREATE POLICY "Users can update BOMs they created or admins can update any" ON bill_of_materials
FOR UPDATE USING (auth.uid() = created_by OR is_admin(auth.uid()));

CREATE POLICY "Admins can delete BOMs" ON bill_of_materials
FOR DELETE USING (is_admin(auth.uid()));

-- Create RLS policies for bom_items
CREATE POLICY "Authenticated users can view BOM items" ON bom_items
FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "Users can manage BOM items for BOMs they have access to" ON bom_items
FOR ALL USING (
  EXISTS (
    SELECT 1 FROM bill_of_materials bom 
    WHERE bom.id = bom_items.bom_id 
    AND (bom.created_by = auth.uid() OR is_admin(auth.uid()))
  )
);

-- Add updated_at triggers
CREATE TRIGGER update_bill_of_materials_updated_at
    BEFORE UPDATE ON bill_of_materials
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_bom_items_updated_at
    BEFORE UPDATE ON bom_items
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();