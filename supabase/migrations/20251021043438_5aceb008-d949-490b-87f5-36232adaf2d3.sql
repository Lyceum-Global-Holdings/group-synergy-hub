-- Create bom_size_multipliers table
CREATE TABLE IF NOT EXISTS public.bom_size_multipliers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bom_id UUID NOT NULL REFERENCES public.bill_of_materials(id) ON DELETE CASCADE,
  size VARCHAR(50) NOT NULL,
  multiplier DECIMAL(10, 4) DEFAULT 1.0 CHECK (multiplier > 0),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT unique_bom_size UNIQUE(bom_id, size)
);

-- Enable RLS
ALTER TABLE public.bom_size_multipliers ENABLE ROW LEVEL SECURITY;

-- Create policies for bom_size_multipliers
-- Allow users to view multipliers for BOMs they created or that are in their company
CREATE POLICY "Users can view size multipliers"
  ON public.bom_size_multipliers
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.bill_of_materials bom
      WHERE bom.id = bom_size_multipliers.bom_id
      AND (bom.created_by = auth.uid() OR bom.company_id IS NULL)
    )
  );

CREATE POLICY "Users can create size multipliers"
  ON public.bom_size_multipliers
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.bill_of_materials bom
      WHERE bom.id = bom_size_multipliers.bom_id
      AND (bom.created_by = auth.uid() OR bom.company_id IS NULL)
    )
  );

CREATE POLICY "Users can update size multipliers"
  ON public.bom_size_multipliers
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.bill_of_materials bom
      WHERE bom.id = bom_size_multipliers.bom_id
      AND (bom.created_by = auth.uid() OR bom.company_id IS NULL)
    )
  );

CREATE POLICY "Users can delete size multipliers"
  ON public.bom_size_multipliers
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.bill_of_materials bom
      WHERE bom.id = bom_size_multipliers.bom_id
      AND (bom.created_by = auth.uid() OR bom.company_id IS NULL)
    )
  );

-- Create index for faster lookups
CREATE INDEX idx_bom_size_multipliers_bom_id ON public.bom_size_multipliers(bom_id);

-- Create trigger for updated_at
CREATE TRIGGER update_bom_size_multipliers_updated_at
  BEFORE UPDATE ON public.bom_size_multipliers
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();