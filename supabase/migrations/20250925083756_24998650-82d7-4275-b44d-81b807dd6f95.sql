-- Add new columns to customers table for customer types and company details
ALTER TABLE public.customers 
ADD COLUMN customer_type text NOT NULL DEFAULT 'person' CHECK (customer_type IN ('person', 'company')),
ADD COLUMN company_registration_document_url text,
ADD COLUMN registration_number text,
ADD COLUMN tax_id text,
ADD COLUMN first_name text,
ADD COLUMN last_name text,
ADD COLUMN id_passport_number text;

-- Create storage bucket for customer documents
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'customer-documents', 
  'customer-documents', 
  false,
  10485760, -- 10MB limit
  ARRAY['application/pdf', 'image/jpeg', 'image/png', 'image/jpg']
);

-- Create RLS policies for customer documents bucket
CREATE POLICY "Users can view their own customer documents"
ON storage.objects
FOR SELECT
USING (
  bucket_id = 'customer-documents' 
  AND auth.uid() IS NOT NULL
  AND EXISTS (
    SELECT 1 FROM customers c 
    WHERE c.id::text = (storage.foldername(name))[1] 
    AND (c.created_by = auth.uid() OR is_admin(auth.uid()))
  )
);

CREATE POLICY "Users can upload customer documents for their customers"
ON storage.objects
FOR INSERT
WITH CHECK (
  bucket_id = 'customer-documents'
  AND auth.uid() IS NOT NULL
  AND EXISTS (
    SELECT 1 FROM customers c 
    WHERE c.id::text = (storage.foldername(name))[1] 
    AND (c.created_by = auth.uid() OR is_admin(auth.uid()))
  )
);

CREATE POLICY "Users can update customer documents for their customers"
ON storage.objects
FOR UPDATE
USING (
  bucket_id = 'customer-documents'
  AND auth.uid() IS NOT NULL
  AND EXISTS (
    SELECT 1 FROM customers c 
    WHERE c.id::text = (storage.foldername(name))[1] 
    AND (c.created_by = auth.uid() OR is_admin(auth.uid()))
  )
);

CREATE POLICY "Users can delete customer documents for their customers"
ON storage.objects
FOR DELETE
USING (
  bucket_id = 'customer-documents'
  AND auth.uid() IS NOT NULL
  AND EXISTS (
    SELECT 1 FROM customers c 
    WHERE c.id::text = (storage.foldername(name))[1] 
    AND (c.created_by = auth.uid() OR is_admin(auth.uid()))
  )
);