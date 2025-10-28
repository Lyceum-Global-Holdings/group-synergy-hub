-- Create junction table for BOM to Finished Goods many-to-many relationship
CREATE TABLE IF NOT EXISTS public.bom_finished_goods (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  bom_id UUID NOT NULL REFERENCES public.bill_of_materials(id) ON DELETE CASCADE,
  finished_good_id UUID NOT NULL REFERENCES public.finished_goods(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id),
  UNIQUE(bom_id, finished_good_id)
);

-- Enable RLS
ALTER TABLE public.bom_finished_goods ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Users can view bom_finished_goods for their company"
ON public.bom_finished_goods
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.bill_of_materials bom
    WHERE bom.id = bom_finished_goods.bom_id
    AND (bom.company_id = (SELECT company_id FROM public.profiles WHERE id = auth.uid()) OR bom.company_id IS NULL)
  )
);

CREATE POLICY "Users can insert bom_finished_goods for their company"
ON public.bom_finished_goods
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.bill_of_materials bom
    WHERE bom.id = bom_finished_goods.bom_id
    AND (bom.company_id = (SELECT company_id FROM public.profiles WHERE id = auth.uid()) OR bom.company_id IS NULL)
  )
);

CREATE POLICY "Users can delete bom_finished_goods for their company"
ON public.bom_finished_goods
FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM public.bill_of_materials bom
    WHERE bom.id = bom_finished_goods.bom_id
    AND (bom.company_id = (SELECT company_id FROM public.profiles WHERE id = auth.uid()) OR bom.company_id IS NULL)
  )
);

-- Create index for better query performance
CREATE INDEX idx_bom_finished_goods_bom_id ON public.bom_finished_goods(bom_id);
CREATE INDEX idx_bom_finished_goods_finished_good_id ON public.bom_finished_goods(finished_good_id);