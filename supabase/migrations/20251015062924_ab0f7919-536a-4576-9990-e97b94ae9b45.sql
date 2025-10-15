-- Create storage bucket for GRN invoices
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'grn-invoices',
  'grn-invoices',
  false,
  3145728,
  ARRAY['application/pdf', 'image/jpeg', 'image/png', 'image/jpg']
)
ON CONFLICT (id) DO NOTHING;

-- Add invoice document URL column to goods_receipt_notes
ALTER TABLE public.goods_receipt_notes
ADD COLUMN IF NOT EXISTS invoice_document_url TEXT;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Authenticated users can view GRN invoices" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload GRN invoices" ON storage.objects;
DROP POLICY IF EXISTS "Users can update their own GRN invoices" ON storage.objects;
DROP POLICY IF EXISTS "Admins can delete GRN invoices" ON storage.objects;

-- RLS Policies for grn-invoices bucket
CREATE POLICY "Authenticated users can view GRN invoices"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'grn-invoices' 
    AND auth.uid() IS NOT NULL
  );

CREATE POLICY "Authenticated users can upload GRN invoices"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'grn-invoices' 
    AND auth.uid() IS NOT NULL
  );

CREATE POLICY "Users can update their own GRN invoices"
  ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'grn-invoices' 
    AND auth.uid() IS NOT NULL
  );

CREATE POLICY "Admins can delete GRN invoices"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'grn-invoices' 
    AND (
      is_admin(auth.uid())
      OR auth.uid() = owner
    )
  );