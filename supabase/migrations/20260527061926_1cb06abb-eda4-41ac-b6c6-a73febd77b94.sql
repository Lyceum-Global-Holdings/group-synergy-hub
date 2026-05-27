
ALTER TABLE public.asset_requests
  ADD COLUMN IF NOT EXISTS approved_by_name text,
  ADD COLUMN IF NOT EXISTS mrn_document_url text,
  ADD COLUMN IF NOT EXISTS mrn_document_path text;

INSERT INTO storage.buckets (id, name, public)
VALUES ('asset-request-documents', 'asset-request-documents', false)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Authenticated can read asset request docs"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'asset-request-documents');

CREATE POLICY "Authenticated can upload asset request docs"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'asset-request-documents');

CREATE POLICY "Authenticated can update asset request docs"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'asset-request-documents');

CREATE POLICY "Authenticated can delete asset request docs"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'asset-request-documents');
