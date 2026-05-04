-- Fix GRN invoices bucket: restrict SELECT to company members of the owning GRN
DROP POLICY IF EXISTS "Authenticated users can view GRN invoices" ON storage.objects;

CREATE POLICY "Users can view GRN invoices for their company"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'grn-invoices'
  AND (
    auth.uid() = owner
    OR public.is_admin(auth.uid())
    OR EXISTS (
      SELECT 1
      FROM public.goods_receipt_notes grn
      WHERE grn.invoice_document_url LIKE '%' || storage.objects.name
        AND grn.company_id IS NOT NULL
        AND public.can_access_company(grn.company_id)
    )
  )
);

-- Fix contract-documents bucket: restrict SELECT to documents linked to a contract the user owns/created
DROP POLICY IF EXISTS "Users can view contract documents" ON storage.objects;

CREATE POLICY "Users can view contract documents they own"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'contract-documents'
  AND (
    auth.uid() = owner
    OR public.is_admin(auth.uid())
    OR EXISTS (
      SELECT 1
      FROM public.contract_documents cd
      JOIN public.contracts c ON c.id = cd.contract_id
      WHERE cd.file_path = storage.objects.name
        AND (
          c.created_by = auth.uid()
          OR c.owner_id = auth.uid()
          OR (c.company_id IS NOT NULL AND public.can_access_company(c.company_id))
        )
    )
  )
);