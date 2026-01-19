-- Create the construction-assets storage bucket for inventory images
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'construction-assets',
  'construction-assets',
  true,
  5242880, -- 5MB limit
  ARRAY['image/jpeg', 'image/jpg', 'image/png']
) ON CONFLICT (id) DO NOTHING;

-- Create policy to allow authenticated users to upload files
CREATE POLICY "Authenticated users can upload construction assets"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'construction-assets');

-- Create policy to allow public read access
CREATE POLICY "Public read access for construction assets"
ON storage.objects
FOR SELECT
TO public
USING (bucket_id = 'construction-assets');

-- Create policy to allow authenticated users to update their uploads
CREATE POLICY "Authenticated users can update construction assets"
ON storage.objects
FOR UPDATE
TO authenticated
USING (bucket_id = 'construction-assets');

-- Create policy to allow authenticated users to delete their uploads
CREATE POLICY "Authenticated users can delete construction assets"
ON storage.objects
FOR DELETE
TO authenticated
USING (bucket_id = 'construction-assets');