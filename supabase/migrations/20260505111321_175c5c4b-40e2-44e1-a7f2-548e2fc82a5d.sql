-- 1) Column on MIN to store SRN evidence path
ALTER TABLE public.material_issue_notes
  ADD COLUMN IF NOT EXISTS srn_document_url text;

COMMENT ON COLUMN public.material_issue_notes.srn_document_url IS
  'Storage path in min-srn-documents bucket. Photo/scan of the signed Stock Requisition Note (SRN) — audit evidence per ISO 9001 §7.5 / SOX.';

-- 2) Private storage bucket for SRN evidence
INSERT INTO storage.buckets (id, name, public)
VALUES ('min-srn-documents', 'min-srn-documents', false)
ON CONFLICT (id) DO NOTHING;

-- 3) RLS policies on storage.objects scoped by company_id (first path segment)
DROP POLICY IF EXISTS "MIN SRN: read by company members" ON storage.objects;
CREATE POLICY "MIN SRN: read by company members"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'min-srn-documents'
  AND (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR public.can_access_company(((storage.foldername(name))[1])::uuid)
  )
);

DROP POLICY IF EXISTS "MIN SRN: insert by company members" ON storage.objects;
CREATE POLICY "MIN SRN: insert by company members"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'min-srn-documents'
  AND (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR public.can_access_company(((storage.foldername(name))[1])::uuid)
  )
);

DROP POLICY IF EXISTS "MIN SRN: update by company members" ON storage.objects;
CREATE POLICY "MIN SRN: update by company members"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'min-srn-documents'
  AND (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR public.can_access_company(((storage.foldername(name))[1])::uuid)
  )
);

DROP POLICY IF EXISTS "MIN SRN: delete by company members" ON storage.objects;
CREATE POLICY "MIN SRN: delete by company members"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'min-srn-documents'
  AND (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR public.can_access_company(((storage.foldername(name))[1])::uuid)
  )
);