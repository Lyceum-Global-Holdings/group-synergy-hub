-- Create table for storing detected rooms from floor drawings
CREATE TABLE public.floor_drawing_rooms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  floor_drawing_id UUID NOT NULL REFERENCES public.project_floor_drawings(id) ON DELETE CASCADE,
  room_name VARCHAR(100) NOT NULL,
  room_type VARCHAR(50),
  area_sqm NUMERIC(10,2),
  area_sqft NUMERIC(10,2),
  coordinates JSONB,
  center_x NUMERIC(5,2),
  center_y NUMERIC(5,2),
  width_percent NUMERIC(5,2),
  height_percent NUMERIC(5,2),
  color VARCHAR(20),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add scale_factor column to floor drawings for accurate area calculation
ALTER TABLE public.project_floor_drawings 
ADD COLUMN IF NOT EXISTS scale_factor NUMERIC(10,4),
ADD COLUMN IF NOT EXISTS total_area_sqm NUMERIC(10,2);

-- Create indexes
CREATE INDEX idx_floor_drawing_rooms_drawing_id ON public.floor_drawing_rooms(floor_drawing_id);

-- Enable RLS
ALTER TABLE public.floor_drawing_rooms ENABLE ROW LEVEL SECURITY;

-- RLS Policies for floor_drawing_rooms
CREATE POLICY "Users can view rooms for drawings in their company projects"
ON public.floor_drawing_rooms FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.project_floor_drawings pfd
    JOIN public.construction_projects cp ON pfd.project_id = cp.id
    JOIN public.profiles p ON cp.company_id = p.company_id
    WHERE pfd.id = floor_drawing_rooms.floor_drawing_id
    AND p.user_id = auth.uid()
  )
  OR public.is_super_admin(auth.uid())
);

CREATE POLICY "Users can insert rooms for drawings in their company projects"
ON public.floor_drawing_rooms FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.project_floor_drawings pfd
    JOIN public.construction_projects cp ON pfd.project_id = cp.id
    JOIN public.profiles p ON cp.company_id = p.company_id
    WHERE pfd.id = floor_drawing_rooms.floor_drawing_id
    AND p.user_id = auth.uid()
  )
  OR public.is_super_admin(auth.uid())
);

CREATE POLICY "Users can update rooms for drawings in their company projects"
ON public.floor_drawing_rooms FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.project_floor_drawings pfd
    JOIN public.construction_projects cp ON pfd.project_id = cp.id
    JOIN public.profiles p ON cp.company_id = p.company_id
    WHERE pfd.id = floor_drawing_rooms.floor_drawing_id
    AND p.user_id = auth.uid()
  )
  OR public.is_super_admin(auth.uid())
);

CREATE POLICY "Users can delete rooms for drawings in their company projects"
ON public.floor_drawing_rooms FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM public.project_floor_drawings pfd
    JOIN public.construction_projects cp ON pfd.project_id = cp.id
    JOIN public.profiles p ON cp.company_id = p.company_id
    WHERE pfd.id = floor_drawing_rooms.floor_drawing_id
    AND p.user_id = auth.uid()
  )
  OR public.is_super_admin(auth.uid())
);

-- Trigger for updated_at
CREATE TRIGGER update_floor_drawing_rooms_updated_at
BEFORE UPDATE ON public.floor_drawing_rooms
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();