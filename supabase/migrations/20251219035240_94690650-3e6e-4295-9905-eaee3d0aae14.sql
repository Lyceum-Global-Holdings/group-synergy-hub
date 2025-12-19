-- Create floor_room_material_transactions table
CREATE TABLE public.floor_room_material_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_material_id UUID NOT NULL REFERENCES floor_room_materials(id) ON DELETE CASCADE,
  warehouse_item_id UUID NOT NULL REFERENCES warehouse_items(id),
  room_id UUID NOT NULL REFERENCES floor_drawing_rooms(id) ON DELETE CASCADE,
  transaction_type VARCHAR(20) NOT NULL CHECK (transaction_type IN ('issue', 'return', 'adjustment')),
  quantity NUMERIC NOT NULL,
  previous_quantity NUMERIC NOT NULL DEFAULT 0,
  new_quantity NUMERIC NOT NULL,
  previous_warehouse_stock NUMERIC,
  new_warehouse_stock NUMERIC,
  unit_cost NUMERIC,
  total_value NUMERIC,
  notes TEXT,
  performed_by UUID,
  company_id UUID REFERENCES companies(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create indexes
CREATE INDEX idx_floor_room_material_transactions_room_material ON floor_room_material_transactions(room_material_id);
CREATE INDEX idx_floor_room_material_transactions_warehouse_item ON floor_room_material_transactions(warehouse_item_id);
CREATE INDEX idx_floor_room_material_transactions_room ON floor_room_material_transactions(room_id);
CREATE INDEX idx_floor_room_material_transactions_company ON floor_room_material_transactions(company_id);

-- Enable RLS
ALTER TABLE floor_room_material_transactions ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Authenticated users can view transactions" ON floor_room_material_transactions
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can create transactions" ON floor_room_material_transactions
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Admins can update transactions" ON floor_room_material_transactions
  FOR UPDATE USING (is_admin(auth.uid()));

CREATE POLICY "Admins can delete transactions" ON floor_room_material_transactions
  FOR DELETE USING (is_admin(auth.uid()));