-- Add item_code to po_items table for better linking with warehouse items and BOMs
ALTER TABLE po_items ADD COLUMN item_code TEXT;

-- Create material_demand table to track demand calculations and forecasts
CREATE TABLE material_demand (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  item_code TEXT NOT NULL,
  item_name TEXT NOT NULL,
  gross_requirement NUMERIC NOT NULL DEFAULT 0,
  current_stock NUMERIC NOT NULL DEFAULT 0,
  on_order_quantity NUMERIC NOT NULL DEFAULT 0,
  net_requirement NUMERIC NOT NULL DEFAULT 0,
  suggested_order_quantity NUMERIC NOT NULL DEFAULT 0,
  reorder_level NUMERIC DEFAULT 0,
  lead_time_days INTEGER DEFAULT 7,
  safety_stock NUMERIC DEFAULT 0,
  demand_date DATE NOT NULL,
  demand_source TEXT NOT NULL, -- 'bom', 'forecast', 'manual'
  reference_id UUID, -- BOM ID, forecast ID, etc.
  status TEXT NOT NULL DEFAULT 'calculated', -- 'calculated', 'ordered', 'fulfilled'
  notes TEXT,
  company_id UUID,
  created_by UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on material_demand table
ALTER TABLE material_demand ENABLE ROW LEVEL SECURITY;

-- Create policies for material_demand
CREATE POLICY "Authenticated users can view material demand" 
ON material_demand 
FOR SELECT 
USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can create material demand" 
ON material_demand 
FOR INSERT 
WITH CHECK (auth.uid() IS NOT NULL AND auth.uid() = created_by);

CREATE POLICY "Users can update their own demand records or admins can update any" 
ON material_demand 
FOR UPDATE 
USING (auth.uid() = created_by OR is_admin(auth.uid()));

CREATE POLICY "Admins can delete material demand records" 
ON material_demand 
FOR DELETE 
USING (is_admin(auth.uid()));

-- Create material_demand_items table for detailed breakdown
CREATE TABLE material_demand_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  demand_id UUID NOT NULL REFERENCES material_demand(id) ON DELETE CASCADE,
  bom_id UUID, -- Reference to BOM if demand comes from BOM
  bom_item_id UUID, -- Reference to specific BOM item
  po_id UUID, -- Reference to PO if this is supply
  po_item_id UUID, -- Reference to specific PO item
  warehouse_item_id UUID, -- Reference to warehouse item
  quantity_required NUMERIC NOT NULL DEFAULT 0,
  unit_of_measure TEXT NOT NULL DEFAULT 'pcs',
  unit_cost NUMERIC,
  total_cost NUMERIC,
  required_date DATE NOT NULL,
  priority TEXT NOT NULL DEFAULT 'medium', -- 'low', 'medium', 'high', 'urgent'
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on material_demand_items table
ALTER TABLE material_demand_items ENABLE ROW LEVEL SECURITY;

-- Create policies for material_demand_items
CREATE POLICY "Users can view demand items they have access to" 
ON material_demand_items 
FOR SELECT 
USING (EXISTS (
  SELECT 1 FROM material_demand md 
  WHERE md.id = material_demand_items.demand_id 
  AND (md.created_by = auth.uid() OR is_admin(auth.uid()))
));

CREATE POLICY "Users can manage demand items for their own demands" 
ON material_demand_items 
FOR ALL 
USING (EXISTS (
  SELECT 1 FROM material_demand md 
  WHERE md.id = material_demand_items.demand_id 
  AND (md.created_by = auth.uid() OR is_admin(auth.uid()))
));

-- Add indexes for better performance
CREATE INDEX idx_material_demand_item_code ON material_demand(item_code);
CREATE INDEX idx_material_demand_date ON material_demand(demand_date);
CREATE INDEX idx_material_demand_status ON material_demand(status);
CREATE INDEX idx_material_demand_items_demand_id ON material_demand_items(demand_id);
CREATE INDEX idx_material_demand_items_required_date ON material_demand_items(required_date);

-- Add trigger to update updated_at timestamp
CREATE TRIGGER update_material_demand_updated_at
  BEFORE UPDATE ON material_demand
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_material_demand_items_updated_at
  BEFORE UPDATE ON material_demand_items
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();