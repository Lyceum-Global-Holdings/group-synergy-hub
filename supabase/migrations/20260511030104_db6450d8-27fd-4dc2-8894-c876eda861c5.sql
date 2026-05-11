
-- stock_adjustment_batches: drop broad SELECT
DROP POLICY IF EXISTS "Users can view adjustment batches in their company" ON public.stock_adjustment_batches;

-- supplier_registration_requests: drop broad SELECT
DROP POLICY IF EXISTS "Authenticated users can view registration requests" ON public.supplier_registration_requests;

-- floor_room_material_transactions: replace SELECT and INSERT
DROP POLICY IF EXISTS "Authenticated users can view transactions" ON public.floor_room_material_transactions;
CREATE POLICY "Users can view transactions in their company"
ON public.floor_room_material_transactions
FOR SELECT
USING (company_id IS NULL OR can_access_company(company_id) OR is_admin(auth.uid()) OR is_super_admin(auth.uid()));

DROP POLICY IF EXISTS "Authenticated users can create transactions" ON public.floor_room_material_transactions;
CREATE POLICY "Users can create transactions in their company"
ON public.floor_room_material_transactions
FOR INSERT
WITH CHECK (auth.uid() IS NOT NULL AND (company_id IS NULL OR can_access_company(company_id) OR is_admin(auth.uid()) OR is_super_admin(auth.uid())));

-- tool_adjustments: replace broad SELECT
DROP POLICY IF EXISTS "Authenticated users can view tool adjustments" ON public.tool_adjustments;
CREATE POLICY "Users can view tool adjustments in their company"
ON public.tool_adjustments
FOR SELECT
USING (company_id IS NULL OR can_access_company(company_id) OR is_admin(auth.uid()) OR is_super_admin(auth.uid()));

-- company_excluded_categories: tighten all
DROP POLICY IF EXISTS "Authenticated users can view excluded categories" ON public.company_excluded_categories;
CREATE POLICY "Users can view excluded categories in their company"
ON public.company_excluded_categories
FOR SELECT
USING (can_access_company(company_id) OR is_admin(auth.uid()) OR is_super_admin(auth.uid()));

DROP POLICY IF EXISTS "Authenticated users can insert excluded categories" ON public.company_excluded_categories;
CREATE POLICY "Users can insert excluded categories in their company"
ON public.company_excluded_categories
FOR INSERT
WITH CHECK (auth.uid() = excluded_by AND (can_access_company(company_id) OR is_admin(auth.uid()) OR is_super_admin(auth.uid())));

DROP POLICY IF EXISTS "Authenticated users can delete excluded categories" ON public.company_excluded_categories;
CREATE POLICY "Users can delete excluded categories in their company"
ON public.company_excluded_categories
FOR DELETE
USING (can_access_company(company_id) OR is_admin(auth.uid()) OR is_super_admin(auth.uid()));

-- construction_labour_categories: tighten writes
DROP POLICY IF EXISTS "Users can insert labour categories" ON public.construction_labour_categories;
CREATE POLICY "Users can insert labour categories in their company"
ON public.construction_labour_categories
FOR INSERT
WITH CHECK (auth.uid() IS NOT NULL AND (company_id IS NULL OR can_access_company(company_id) OR is_admin(auth.uid()) OR is_super_admin(auth.uid())));

DROP POLICY IF EXISTS "Users can update labour categories" ON public.construction_labour_categories;
CREATE POLICY "Users can update labour categories in their company"
ON public.construction_labour_categories
FOR UPDATE
USING (company_id IS NULL OR can_access_company(company_id) OR is_admin(auth.uid()) OR is_super_admin(auth.uid()));

DROP POLICY IF EXISTS "Users can delete labour categories" ON public.construction_labour_categories;
CREATE POLICY "Users can delete labour categories in their company"
ON public.construction_labour_categories
FOR DELETE
USING (company_id IS NULL OR can_access_company(company_id) OR is_admin(auth.uid()) OR is_super_admin(auth.uid()));

-- construction_labour_companies: tighten writes
DROP POLICY IF EXISTS "Users can insert labour companies" ON public.construction_labour_companies;
CREATE POLICY "Users can insert labour companies in their company"
ON public.construction_labour_companies
FOR INSERT
WITH CHECK (auth.uid() IS NOT NULL AND (company_id IS NULL OR can_access_company(company_id) OR is_admin(auth.uid()) OR is_super_admin(auth.uid())));

DROP POLICY IF EXISTS "Users can update labour companies" ON public.construction_labour_companies;
CREATE POLICY "Users can update labour companies in their company"
ON public.construction_labour_companies
FOR UPDATE
USING (company_id IS NULL OR can_access_company(company_id) OR is_admin(auth.uid()) OR is_super_admin(auth.uid()));

DROP POLICY IF EXISTS "Users can delete labour companies" ON public.construction_labour_companies;
CREATE POLICY "Users can delete labour companies in their company"
ON public.construction_labour_companies
FOR DELETE
USING (company_id IS NULL OR can_access_company(company_id) OR is_admin(auth.uid()) OR is_super_admin(auth.uid()));
