-- Add image_url column to warehouse_items table
ALTER TABLE public.warehouse_items ADD COLUMN IF NOT EXISTS image_url TEXT;

-- Create storage bucket for item images
INSERT INTO storage.buckets (id, name, public)
VALUES ('item-images', 'item-images', true)
ON CONFLICT (id) DO NOTHING;

-- Create storage policies for item images bucket
CREATE POLICY "Authenticated users can upload item images"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'item-images');

CREATE POLICY "Authenticated users can update item images"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'item-images');

CREATE POLICY "Authenticated users can delete item images"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'item-images');

CREATE POLICY "Anyone can view item images"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'item-images');