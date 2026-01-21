-- Fix remaining BOM tables RLS policies
-- Drop existing policy that caused conflict
DROP POLICY IF EXISTS "Admins can delete BOMs" ON public.bill_of_materials;

-- Create admin-only DELETE policy for bill_of_materials
CREATE POLICY "Admins can delete BOMs"
ON public.bill_of_materials FOR DELETE
TO authenticated
USING (
  is_super_admin(auth.uid()) OR
  (can_access_company(company_id) AND is_admin(auth.uid()))
);

-- =====================================================
-- BOM_ITEMS TABLE - Complete remaining policies
-- =====================================================

-- Create admin-only DELETE policy for bom_items
DROP POLICY IF EXISTS "Admins can delete BOM items" ON public.bom_items;
CREATE POLICY "Admins can delete BOM items"
ON public.bom_items FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.bill_of_materials bom
    WHERE bom.id = bom_items.bom_id
    AND (
      is_super_admin(auth.uid()) OR
      (can_access_company(bom.company_id) AND is_admin(auth.uid()))
    )
  )
);

-- =====================================================
-- BOM_APPROVALS TABLE (child of bill_of_materials)
-- =====================================================

DROP POLICY IF EXISTS "Users can view BOM approvals" ON public.bom_approvals;
DROP POLICY IF EXISTS "Users can create BOM approvals" ON public.bom_approvals;
DROP POLICY IF EXISTS "Users can update BOM approvals" ON public.bom_approvals;
DROP POLICY IF EXISTS "Company users can view BOM approvals" ON public.bom_approvals;
DROP POLICY IF EXISTS "Company users can create BOM approvals" ON public.bom_approvals;
DROP POLICY IF EXISTS "Company users can update BOM approvals" ON public.bom_approvals;

CREATE POLICY "Company users can view BOM approvals"
ON public.bom_approvals FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.bill_of_materials bom
    WHERE bom.id = bom_approvals.bom_id
    AND (
      is_super_admin(auth.uid()) OR
      (
        can_access_company(bom.company_id) AND 
        (has_procurement_access(auth.uid()) OR has_warehouse_access(auth.uid()) OR is_admin(auth.uid()))
      )
    )
  )
);

CREATE POLICY "Company users can create BOM approvals"
ON public.bom_approvals FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.bill_of_materials bom
    WHERE bom.id = bom_approvals.bom_id
    AND (
      is_super_admin(auth.uid()) OR
      (
        can_access_company(bom.company_id) AND 
        (has_manager_access(auth.uid()) OR is_admin(auth.uid()))
      )
    )
  )
);

CREATE POLICY "Company users can update BOM approvals"
ON public.bom_approvals FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.bill_of_materials bom
    WHERE bom.id = bom_approvals.bom_id
    AND (
      is_super_admin(auth.uid()) OR
      (
        can_access_company(bom.company_id) AND 
        (has_manager_access(auth.uid()) OR is_admin(auth.uid()))
      )
    )
  )
);

-- =====================================================
-- BOM_FINISHED_GOODS TABLE (child of bill_of_materials)
-- =====================================================

DROP POLICY IF EXISTS "Users can view BOM finished goods" ON public.bom_finished_goods;
DROP POLICY IF EXISTS "Users can create BOM finished goods" ON public.bom_finished_goods;
DROP POLICY IF EXISTS "Company users can view BOM finished goods" ON public.bom_finished_goods;
DROP POLICY IF EXISTS "Company users can create BOM finished goods" ON public.bom_finished_goods;

CREATE POLICY "Company users can view BOM finished goods"
ON public.bom_finished_goods FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.bill_of_materials bom
    WHERE bom.id = bom_finished_goods.bom_id
    AND (
      is_super_admin(auth.uid()) OR
      (
        can_access_company(bom.company_id) AND 
        (has_procurement_access(auth.uid()) OR has_warehouse_access(auth.uid()) OR is_admin(auth.uid()))
      )
    )
  )
);

CREATE POLICY "Company users can create BOM finished goods"
ON public.bom_finished_goods FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.bill_of_materials bom
    WHERE bom.id = bom_finished_goods.bom_id
    AND (
      is_super_admin(auth.uid()) OR
      (
        can_access_company(bom.company_id) AND 
        (has_procurement_access(auth.uid()) OR has_warehouse_access(auth.uid()) OR is_admin(auth.uid()))
      )
    )
  )
);

-- =====================================================
-- BOM_ITEM_SUBSTITUTIONS TABLE (child of bom_items)
-- =====================================================

DROP POLICY IF EXISTS "Users can view BOM substitutions" ON public.bom_item_substitutions;
DROP POLICY IF EXISTS "Users can create BOM substitutions" ON public.bom_item_substitutions;
DROP POLICY IF EXISTS "Users can update BOM substitutions" ON public.bom_item_substitutions;
DROP POLICY IF EXISTS "Company users can view BOM substitutions" ON public.bom_item_substitutions;
DROP POLICY IF EXISTS "Company users can create BOM substitutions" ON public.bom_item_substitutions;
DROP POLICY IF EXISTS "Company users can update BOM substitutions" ON public.bom_item_substitutions;

CREATE POLICY "Company users can view BOM substitutions"
ON public.bom_item_substitutions FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.bom_items bi
    JOIN public.bill_of_materials bom ON bom.id = bi.bom_id
    WHERE bi.id = bom_item_substitutions.bom_item_id
    AND (
      is_super_admin(auth.uid()) OR
      (
        can_access_company(bom.company_id) AND 
        (has_procurement_access(auth.uid()) OR has_warehouse_access(auth.uid()) OR is_admin(auth.uid()))
      )
    )
  )
);

CREATE POLICY "Company users can create BOM substitutions"
ON public.bom_item_substitutions FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.bom_items bi
    JOIN public.bill_of_materials bom ON bom.id = bi.bom_id
    WHERE bi.id = bom_item_substitutions.bom_item_id
    AND (
      is_super_admin(auth.uid()) OR
      (
        can_access_company(bom.company_id) AND 
        (has_procurement_access(auth.uid()) OR has_warehouse_access(auth.uid()) OR is_admin(auth.uid()))
      )
    )
  )
);

CREATE POLICY "Company users can update BOM substitutions"
ON public.bom_item_substitutions FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.bom_items bi
    JOIN public.bill_of_materials bom ON bom.id = bi.bom_id
    WHERE bi.id = bom_item_substitutions.bom_item_id
    AND (
      is_super_admin(auth.uid()) OR
      (
        can_access_company(bom.company_id) AND 
        (has_procurement_access(auth.uid()) OR has_warehouse_access(auth.uid()) OR is_admin(auth.uid()))
      )
    )
  )
);