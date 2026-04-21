
-- ============================================================
-- 1) Fix CROSS_COMPANY_DATA_EXPOSURE: replace permissive `true` SELECT policies
--    with company-scoped checks on construction tables
-- ============================================================

-- construction_work_orders
DROP POLICY IF EXISTS "Users can view work orders" ON public.construction_work_orders;
CREATE POLICY "Users can view work orders"
ON public.construction_work_orders
FOR SELECT
TO authenticated
USING (can_access_company(company_id));

-- daily_site_reports
DROP POLICY IF EXISTS "Users can view daily reports" ON public.daily_site_reports;
CREATE POLICY "Users can view daily reports"
ON public.daily_site_reports
FOR SELECT
TO authenticated
USING (can_access_company(company_id));

-- quality_inspections
DROP POLICY IF EXISTS "Users can view quality inspections" ON public.quality_inspections;
CREATE POLICY "Users can view quality inspections"
ON public.quality_inspections
FOR SELECT
TO authenticated
USING (can_access_company(company_id));

-- construction_resources
DROP POLICY IF EXISTS "Users can view resources" ON public.construction_resources;
CREATE POLICY "Users can view resources"
ON public.construction_resources
FOR SELECT
TO authenticated
USING (can_access_company(company_id));

-- floor_room_materials (drop the duplicate permissive `true` policy; the
-- company-scoped policy "Authenticated users can view room materials" already exists)
DROP POLICY IF EXISTS "Authenticated users can view floor room materials" ON public.floor_room_materials;

-- ============================================================
-- 2) Tighten write/delete policies on construction tables to also be
--    company-scoped (currently only check auth.uid() IS NOT NULL)
-- ============================================================

-- construction_work_orders
DROP POLICY IF EXISTS "Authenticated users can update work orders" ON public.construction_work_orders;
CREATE POLICY "Authenticated users can update work orders"
ON public.construction_work_orders
FOR UPDATE
TO authenticated
USING (can_access_company(company_id))
WITH CHECK (can_access_company(company_id));

DROP POLICY IF EXISTS "Authenticated users can delete work orders" ON public.construction_work_orders;
CREATE POLICY "Authenticated users can delete work orders"
ON public.construction_work_orders
FOR DELETE
TO authenticated
USING (can_access_company(company_id));

-- daily_site_reports
DROP POLICY IF EXISTS "Authenticated users can update daily reports" ON public.daily_site_reports;
CREATE POLICY "Authenticated users can update daily reports"
ON public.daily_site_reports
FOR UPDATE
TO authenticated
USING (can_access_company(company_id))
WITH CHECK (can_access_company(company_id));

DROP POLICY IF EXISTS "Authenticated users can delete daily reports" ON public.daily_site_reports;
CREATE POLICY "Authenticated users can delete daily reports"
ON public.daily_site_reports
FOR DELETE
TO authenticated
USING (can_access_company(company_id));

-- quality_inspections
DROP POLICY IF EXISTS "Authenticated users can update quality inspections" ON public.quality_inspections;
CREATE POLICY "Authenticated users can update quality inspections"
ON public.quality_inspections
FOR UPDATE
TO authenticated
USING (can_access_company(company_id))
WITH CHECK (can_access_company(company_id));

DROP POLICY IF EXISTS "Authenticated users can delete quality inspections" ON public.quality_inspections;
CREATE POLICY "Authenticated users can delete quality inspections"
ON public.quality_inspections
FOR DELETE
TO authenticated
USING (can_access_company(company_id));

-- construction_resources
DROP POLICY IF EXISTS "Authenticated users can update resources" ON public.construction_resources;
CREATE POLICY "Authenticated users can update resources"
ON public.construction_resources
FOR UPDATE
TO authenticated
USING (can_access_company(company_id))
WITH CHECK (can_access_company(company_id));

DROP POLICY IF EXISTS "Authenticated users can delete resources" ON public.construction_resources;
CREATE POLICY "Authenticated users can delete resources"
ON public.construction_resources
FOR DELETE
TO authenticated
USING (can_access_company(company_id));

-- floor_room_materials
DROP POLICY IF EXISTS "Authenticated users can update room materials" ON public.floor_room_materials;
CREATE POLICY "Authenticated users can update room materials"
ON public.floor_room_materials
FOR UPDATE
TO authenticated
USING (can_access_company(company_id))
WITH CHECK (can_access_company(company_id));

DROP POLICY IF EXISTS "Authenticated users can delete room materials" ON public.floor_room_materials;
CREATE POLICY "Authenticated users can delete room materials"
ON public.floor_room_materials
FOR DELETE
TO authenticated
USING (can_access_company(company_id));

-- ============================================================
-- 3) Tighten STORAGE policies to verify ownership / company access
-- ============================================================

-- Helper: check membership via path's first folder being the user's id
-- For grn-invoices: restrict writes to admins or owner of the file
DROP POLICY IF EXISTS "Authenticated users can upload GRN invoices" ON storage.objects;
CREATE POLICY "Authenticated users can upload GRN invoices"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'grn-invoices'
  AND auth.uid() IS NOT NULL
  AND owner = auth.uid()
);

DROP POLICY IF EXISTS "Users can update their own GRN invoices" ON storage.objects;
CREATE POLICY "Users can update their own GRN invoices"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'grn-invoices'
  AND (owner = auth.uid() OR is_admin(auth.uid()))
)
WITH CHECK (
  bucket_id = 'grn-invoices'
  AND (owner = auth.uid() OR is_admin(auth.uid()))
);

-- asset-images: only owner or admin can update/delete
DROP POLICY IF EXISTS "Authenticated users can upload asset images" ON storage.objects;
CREATE POLICY "Authenticated users can upload asset images"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'asset-images'
  AND auth.uid() IS NOT NULL
  AND owner = auth.uid()
);

DROP POLICY IF EXISTS "Users can update their own asset images" ON storage.objects;
CREATE POLICY "Users can update their own asset images"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'asset-images'
  AND (owner = auth.uid() OR is_admin(auth.uid()))
)
WITH CHECK (
  bucket_id = 'asset-images'
  AND (owner = auth.uid() OR is_admin(auth.uid()))
);

DROP POLICY IF EXISTS "Users can delete their own asset images" ON storage.objects;
CREATE POLICY "Users can delete their own asset images"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'asset-images'
  AND (owner = auth.uid() OR is_admin(auth.uid()))
);

-- item-images: only owner or admin can update/delete
DROP POLICY IF EXISTS "Authenticated users can upload item images" ON storage.objects;
CREATE POLICY "Authenticated users can upload item images"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'item-images'
  AND auth.uid() IS NOT NULL
  AND owner = auth.uid()
);

DROP POLICY IF EXISTS "Authenticated users can update item images" ON storage.objects;
CREATE POLICY "Authenticated users can update item images"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'item-images'
  AND (owner = auth.uid() OR is_admin(auth.uid()))
)
WITH CHECK (
  bucket_id = 'item-images'
  AND (owner = auth.uid() OR is_admin(auth.uid()))
);

DROP POLICY IF EXISTS "Authenticated users can delete item images" ON storage.objects;
CREATE POLICY "Authenticated users can delete item images"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'item-images'
  AND (owner = auth.uid() OR is_admin(auth.uid()))
);

-- contract-documents: only owner or admin can write/update/delete
DROP POLICY IF EXISTS "Users can upload contract documents" ON storage.objects;
CREATE POLICY "Users can upload contract documents"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'contract-documents'
  AND auth.uid() IS NOT NULL
  AND owner = auth.uid()
);

DROP POLICY IF EXISTS "Users can update contract documents" ON storage.objects;
CREATE POLICY "Users can update contract documents"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'contract-documents'
  AND (owner = auth.uid() OR is_admin(auth.uid()))
)
WITH CHECK (
  bucket_id = 'contract-documents'
  AND (owner = auth.uid() OR is_admin(auth.uid()))
);

DROP POLICY IF EXISTS "Users can delete contract documents" ON storage.objects;
CREATE POLICY "Users can delete contract documents"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'contract-documents'
  AND (owner = auth.uid() OR is_admin(auth.uid()))
);
