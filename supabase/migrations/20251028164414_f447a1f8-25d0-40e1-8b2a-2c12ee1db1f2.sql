-- Fix RLS policies for bom_finished_goods to handle NULL company_id

-- Drop existing policies
DROP POLICY IF EXISTS "Users can insert bom_finished_goods for their company" ON public.bom_finished_goods;
DROP POLICY IF EXISTS "Users can view bom_finished_goods for their company" ON public.bom_finished_goods;
DROP POLICY IF EXISTS "Users can delete bom_finished_goods for their company" ON public.bom_finished_goods;

-- Create improved INSERT policy
CREATE POLICY "Users can insert bom_finished_goods for their company"
ON public.bom_finished_goods
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.bill_of_materials bom
    JOIN public.profiles p ON p.id = auth.uid()
    WHERE bom.id = bom_finished_goods.bom_id
    AND (
      bom.company_id = p.company_id 
      OR (bom.company_id IS NULL AND p.company_id IS NULL)
      OR bom.company_id IS NULL
    )
  )
);

-- Create improved SELECT policy
CREATE POLICY "Users can view bom_finished_goods for their company"
ON public.bom_finished_goods
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.bill_of_materials bom
    JOIN public.profiles p ON p.id = auth.uid()
    WHERE bom.id = bom_finished_goods.bom_id
    AND (
      bom.company_id = p.company_id 
      OR (bom.company_id IS NULL AND p.company_id IS NULL)
      OR bom.company_id IS NULL
    )
  )
);

-- Create improved DELETE policy
CREATE POLICY "Users can delete bom_finished_goods for their company"
ON public.bom_finished_goods
FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM public.bill_of_materials bom
    JOIN public.profiles p ON p.id = auth.uid()
    WHERE bom.id = bom_finished_goods.bom_id
    AND (
      bom.company_id = p.company_id 
      OR (bom.company_id IS NULL AND p.company_id IS NULL)
      OR bom.company_id IS NULL
    )
  )
);