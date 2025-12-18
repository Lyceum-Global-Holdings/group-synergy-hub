-- Create floor_room_stages table for tracking construction stages per room
CREATE TABLE public.floor_room_stages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id UUID NOT NULL REFERENCES public.floor_drawing_rooms(id) ON DELETE CASCADE,
  company_id UUID REFERENCES public.companies(id),
  stage_order INTEGER NOT NULL,
  stage_name VARCHAR(100) NOT NULL,
  description TEXT,
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed', 'blocked')),
  completion_percentage NUMERIC(5,2) DEFAULT 0 CHECK (completion_percentage >= 0 AND completion_percentage <= 100),
  planned_start_date DATE,
  planned_end_date DATE,
  actual_start_date DATE,
  actual_end_date DATE,
  assigned_to UUID,
  notes TEXT,
  created_by UUID,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create index for faster lookups
CREATE INDEX idx_floor_room_stages_room_id ON public.floor_room_stages(room_id);

-- Enable RLS
ALTER TABLE public.floor_room_stages ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view room stages"
  ON public.floor_room_stages FOR SELECT
  USING (true);

CREATE POLICY "Authenticated users can create room stages"
  ON public.floor_room_stages FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can update room stages"
  ON public.floor_room_stages FOR UPDATE
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can delete room stages"
  ON public.floor_room_stages FOR DELETE
  USING (auth.uid() IS NOT NULL);

-- Trigger for updated_at
CREATE TRIGGER update_floor_room_stages_updated_at
  BEFORE UPDATE ON public.floor_room_stages
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();