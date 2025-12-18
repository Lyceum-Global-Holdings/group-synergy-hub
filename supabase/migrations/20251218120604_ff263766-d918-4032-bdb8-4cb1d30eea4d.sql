-- Create floor_room_materials table for tracking materials allocated to rooms
CREATE TABLE public.floor_room_materials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id UUID NOT NULL REFERENCES public.floor_drawing_rooms(id) ON DELETE CASCADE,
  warehouse_item_id UUID NOT NULL REFERENCES public.warehouse_items(id) ON DELETE RESTRICT,
  company_id UUID REFERENCES public.companies(id),
  quantity_required NUMERIC(12,3) NOT NULL DEFAULT 0,
  quantity_allocated NUMERIC(12,3) DEFAULT 0,
  quantity_used NUMERIC(12,3) DEFAULT 0,
  unit_cost NUMERIC(12,2),
  total_cost NUMERIC(12,2),
  status VARCHAR(20) DEFAULT 'planned' CHECK (status IN ('planned', 'allocated', 'partially_used', 'fully_used')),
  notes TEXT,
  created_by UUID,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(room_id, warehouse_item_id)
);

-- Create indexes for better query performance
CREATE INDEX idx_floor_room_materials_room_id ON public.floor_room_materials(room_id);
CREATE INDEX idx_floor_room_materials_warehouse_item_id ON public.floor_room_materials(warehouse_item_id);
CREATE INDEX idx_floor_room_materials_company_id ON public.floor_room_materials(company_id);

-- Enable Row Level Security
ALTER TABLE public.floor_room_materials ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view room materials"
  ON public.floor_room_materials
  FOR SELECT
  USING (true);

CREATE POLICY "Users can create room materials"
  ON public.floor_room_materials
  FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Users can update room materials"
  ON public.floor_room_materials
  FOR UPDATE
  USING (true);

CREATE POLICY "Users can delete room materials"
  ON public.floor_room_materials
  FOR DELETE
  USING (true);

-- Add trigger for updated_at
CREATE TRIGGER update_floor_room_materials_updated_at
  BEFORE UPDATE ON public.floor_room_materials
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();