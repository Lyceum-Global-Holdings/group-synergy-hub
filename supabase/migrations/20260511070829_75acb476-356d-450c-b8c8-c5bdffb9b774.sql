
-- 1) accounting_periods: company-scoped SELECT
DROP POLICY IF EXISTS "Authenticated users can view accounting periods" ON public.accounting_periods;
DROP POLICY IF EXISTS "Users can view accounting periods" ON public.accounting_periods;
DROP POLICY IF EXISTS "View accounting periods" ON public.accounting_periods;
DROP POLICY IF EXISTS "accounting_periods_select" ON public.accounting_periods;

CREATE POLICY "accounting_periods_select_company_scoped"
ON public.accounting_periods
FOR SELECT
TO authenticated
USING (public.can_access_company(company_id) OR public.is_admin(auth.uid()));

-- 2) supplier_recommendations: company-scoped INSERT/UPDATE
DROP POLICY IF EXISTS "Authenticated users can create supplier recommendations" ON public.supplier_recommendations;
DROP POLICY IF EXISTS "Authenticated users can insert supplier recommendations" ON public.supplier_recommendations;
DROP POLICY IF EXISTS "Authenticated users can update supplier recommendations" ON public.supplier_recommendations;
DROP POLICY IF EXISTS "supplier_recommendations_insert" ON public.supplier_recommendations;
DROP POLICY IF EXISTS "supplier_recommendations_update" ON public.supplier_recommendations;

CREATE POLICY "supplier_recommendations_insert_company_scoped"
ON public.supplier_recommendations
FOR INSERT
TO authenticated
WITH CHECK (public.can_access_company(company_id));

CREATE POLICY "supplier_recommendations_update_company_scoped"
ON public.supplier_recommendations
FOR UPDATE
TO authenticated
USING (public.can_access_company(company_id))
WITH CHECK (public.can_access_company(company_id));

-- 3) supplier_analytics_cache: replace permissive ALL with company-scoped writes
DROP POLICY IF EXISTS "Authenticated users can manage supplier analytics" ON public.supplier_analytics_cache;
DROP POLICY IF EXISTS "Authenticated users can manage supplier analytics cache" ON public.supplier_analytics_cache;
DROP POLICY IF EXISTS "supplier_analytics_cache_all" ON public.supplier_analytics_cache;
DROP POLICY IF EXISTS "Users can manage supplier analytics" ON public.supplier_analytics_cache;

CREATE POLICY "supplier_analytics_cache_insert_company_scoped"
ON public.supplier_analytics_cache
FOR INSERT
TO authenticated
WITH CHECK (public.can_access_company(company_id));

CREATE POLICY "supplier_analytics_cache_update_company_scoped"
ON public.supplier_analytics_cache
FOR UPDATE
TO authenticated
USING (public.can_access_company(company_id))
WITH CHECK (public.can_access_company(company_id));

CREATE POLICY "supplier_analytics_cache_delete_company_scoped"
ON public.supplier_analytics_cache
FOR DELETE
TO authenticated
USING (public.can_access_company(company_id));

-- 4) bom_size_multipliers: restrict global-BOM writes to admins (table is bill_of_materials)
DROP POLICY IF EXISTS "Users can create size multipliers" ON public.bom_size_multipliers;
DROP POLICY IF EXISTS "Users can update size multipliers" ON public.bom_size_multipliers;
DROP POLICY IF EXISTS "Users can delete size multipliers" ON public.bom_size_multipliers;

CREATE POLICY "bom_size_multipliers_insert_scoped"
ON public.bom_size_multipliers
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.bill_of_materials bom
    WHERE bom.id = bom_size_multipliers.bom_id
      AND (
        public.can_access_company(bom.company_id)
        OR (bom.company_id IS NULL AND public.is_admin(auth.uid()))
      )
  )
);

CREATE POLICY "bom_size_multipliers_update_scoped"
ON public.bom_size_multipliers
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.bill_of_materials bom
    WHERE bom.id = bom_size_multipliers.bom_id
      AND (
        public.can_access_company(bom.company_id)
        OR (bom.company_id IS NULL AND public.is_admin(auth.uid()))
      )
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.bill_of_materials bom
    WHERE bom.id = bom_size_multipliers.bom_id
      AND (
        public.can_access_company(bom.company_id)
        OR (bom.company_id IS NULL AND public.is_admin(auth.uid()))
      )
  )
);

CREATE POLICY "bom_size_multipliers_delete_scoped"
ON public.bom_size_multipliers
FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.bill_of_materials bom
    WHERE bom.id = bom_size_multipliers.bom_id
      AND (
        public.can_access_company(bom.company_id)
        OR (bom.company_id IS NULL AND public.is_admin(auth.uid()))
      )
  )
);
