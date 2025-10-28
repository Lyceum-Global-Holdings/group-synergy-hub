-- Refine RLS for bom_finished_goods to avoid hard dependency on profiles row
-- and allow admins and BOM creators. This should fix INSERT denial for super_admins
-- and users who created the BOM, while still scoping by company when available.

-- Drop existing policies
DROP POLICY IF EXISTS "Users can insert bom_finished_goods for their company" ON public.bom_finished_goods;
DROP POLICY IF EXISTS "Users can view bom_finished_goods for their company" ON public.bom_finished_goods;
DROP POLICY IF EXISTS "Users can delete bom_finished_goods for their company" ON public.bom_finished_goods;

-- INSERT policy
CREATE POLICY "Users can insert bom_finished_goods for their company"
ON public.bom_finished_goods
FOR INSERT
WITH CHECK (
  -- Admins bypass
  is_admin(auth.uid())
  OR EXISTS (
    SELECT 1
    FROM public.bill_of_materials bom
    WHERE bom.id = bom_finished_goods.bom_id
      AND (
        -- Legacy/tenantless BOMs
        bom.company_id IS NULL
        -- Same company (if profile exists)
        OR bom.company_id = (
          SELECT p.company_id FROM public.profiles p WHERE p.id = auth.uid()
        )
        -- BOM creator can manage links
        OR bom.created_by = auth.uid()
      )
  )
);

-- SELECT policy
CREATE POLICY "Users can view bom_finished_goods for their company"
ON public.bom_finished_goods
FOR SELECT
USING (
  is_admin(auth.uid())
  OR EXISTS (
    SELECT 1
    FROM public.bill_of_materials bom
    WHERE bom.id = bom_finished_goods.bom_id
      AND (
        bom.company_id IS NULL
        OR bom.company_id = (
          SELECT p.company_id FROM public.profiles p WHERE p.id = auth.uid()
        )
        OR bom.created_by = auth.uid()
      )
  )
);

-- DELETE policy
CREATE POLICY "Users can delete bom_finished_goods for their company"
ON public.bom_finished_goods
FOR DELETE
USING (
  is_admin(auth.uid())
  OR EXISTS (
    SELECT 1
    FROM public.bill_of_materials bom
    WHERE bom.id = bom_finished_goods.bom_id
      AND (
        bom.company_id IS NULL
        OR bom.company_id = (
          SELECT p.company_id FROM public.profiles p WHERE p.id = auth.uid()
        )
        OR bom.created_by = auth.uid()
      )
  )
);