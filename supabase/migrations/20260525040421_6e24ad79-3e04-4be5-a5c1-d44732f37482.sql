-- 1. accounting_periods
DROP POLICY IF EXISTS "Users and admins can view accounting periods" ON public.accounting_periods;

-- 2. bom_item_substitutions: drop broad ALL, add company-scoped writes via bom_items -> bill_of_materials
DROP POLICY IF EXISTS "Users can manage substitutions" ON public.bom_item_substitutions;

CREATE POLICY "bom_item_substitutions_insert_company_scoped"
ON public.bom_item_substitutions
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.bom_items bi
    JOIN public.bill_of_materials b ON b.id = bi.bom_id
    WHERE bi.id = bom_item_substitutions.bom_item_id
      AND public.can_access_company(b.company_id)
  )
);

CREATE POLICY "bom_item_substitutions_update_company_scoped"
ON public.bom_item_substitutions
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.bom_items bi
    JOIN public.bill_of_materials b ON b.id = bi.bom_id
    WHERE bi.id = bom_item_substitutions.bom_item_id
      AND public.can_access_company(b.company_id)
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.bom_items bi
    JOIN public.bill_of_materials b ON b.id = bi.bom_id
    WHERE bi.id = bom_item_substitutions.bom_item_id
      AND public.can_access_company(b.company_id)
  )
);

CREATE POLICY "bom_item_substitutions_delete_company_scoped"
ON public.bom_item_substitutions
FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.bom_items bi
    JOIN public.bill_of_materials b ON b.id = bi.bom_id
    WHERE bi.id = bom_item_substitutions.bom_item_id
      AND public.can_access_company(b.company_id)
  )
);

-- 3. supplier_analytics_cache
DROP POLICY IF EXISTS "System can manage analytics cache" ON public.supplier_analytics_cache;

-- 4. supplier_recommendations
DROP POLICY IF EXISTS "Users can create recommendations" ON public.supplier_recommendations;
DROP POLICY IF EXISTS "Users can update recommendations" ON public.supplier_recommendations;