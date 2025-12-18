-- Create floor-drawings storage bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('floor-drawings', 'floor-drawings', true)
ON CONFLICT (id) DO NOTHING;

-- Allow authenticated users to upload floor drawings
CREATE POLICY "Authenticated users can upload floor drawings"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'floor-drawings');

-- Allow anyone to view floor drawings (public bucket)
CREATE POLICY "Anyone can view floor drawings"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'floor-drawings');

-- Allow users to update their own floor drawings
CREATE POLICY "Users can update their own floor drawings"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'floor-drawings' AND (storage.foldername(name))[1] = auth.uid()::text);

-- Allow users to delete their own floor drawings
CREATE POLICY "Users can delete their own floor drawings"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'floor-drawings' AND (storage.foldername(name))[1] = auth.uid()::text);