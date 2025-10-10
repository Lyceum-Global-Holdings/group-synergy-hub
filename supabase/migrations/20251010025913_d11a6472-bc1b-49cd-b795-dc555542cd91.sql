-- Create storage bucket for contract documents
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'contract-documents',
  'contract-documents',
  false,
  52428800, -- 50MB limit
  ARRAY['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 
        'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'image/jpeg', 'image/png', 'image/gif', 'text/plain']
);

-- RLS policy: Users can upload contract documents
CREATE POLICY "Users can upload contract documents"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'contract-documents'
  AND auth.uid() IS NOT NULL
);

-- RLS policy: Users can view documents for contracts they can access
CREATE POLICY "Users can view contract documents"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'contract-documents'
  AND auth.uid() IS NOT NULL
  AND EXISTS (
    SELECT 1 FROM public.contracts c
    WHERE (
      c.created_by = auth.uid() 
      OR c.owner_id = auth.uid()
      OR is_admin(auth.uid())
    )
  )
);

-- RLS policy: Users can update their contract documents
CREATE POLICY "Users can update contract documents"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'contract-documents'
  AND auth.uid() IS NOT NULL
);

-- RLS policy: Users can delete their contract documents
CREATE POLICY "Users can delete contract documents"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'contract-documents'
  AND auth.uid() IS NOT NULL
);