-- Create training manuals table
CREATE TABLE public.training_manuals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  category TEXT NOT NULL DEFAULT 'user_guide',
  file_path TEXT NOT NULL,
  file_url TEXT,
  file_size BIGINT,
  mime_type TEXT,
  page_count INTEGER,
  version TEXT DEFAULT '1.0',
  is_published BOOLEAN DEFAULT true,
  display_order INTEGER DEFAULT 0,
  tags TEXT[],
  created_by UUID REFERENCES auth.users(id),
  updated_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.training_manuals ENABLE ROW LEVEL SECURITY;

-- RLS Policies
-- All authenticated users can view published manuals
CREATE POLICY "Authenticated users can view published manuals"
ON public.training_manuals
FOR SELECT
TO authenticated
USING (is_published = true);

-- Only super admins can insert manuals
CREATE POLICY "Super admins can create manuals"
ON public.training_manuals
FOR INSERT
TO authenticated
WITH CHECK (is_super_admin(auth.uid()) AND auth.uid() = created_by);

-- Only super admins can update manuals
CREATE POLICY "Super admins can update manuals"
ON public.training_manuals
FOR UPDATE
TO authenticated
USING (is_super_admin(auth.uid()));

-- Only super admins can delete manuals
CREATE POLICY "Super admins can delete manuals"
ON public.training_manuals
FOR DELETE
TO authenticated
USING (is_super_admin(auth.uid()));

-- Create storage bucket for training manuals
INSERT INTO storage.buckets (id, name, public)
VALUES ('training-manuals', 'training-manuals', true);

-- Storage policies
-- Public can view published manual files
CREATE POLICY "Public can view training manuals"
ON storage.objects
FOR SELECT
USING (bucket_id = 'training-manuals');

-- Only super admins can upload files
CREATE POLICY "Super admins can upload training manuals"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'training-manuals' 
  AND is_super_admin(auth.uid())
);

-- Only super admins can update files
CREATE POLICY "Super admins can update training manuals"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'training-manuals' 
  AND is_super_admin(auth.uid())
);

-- Only super admins can delete files
CREATE POLICY "Super admins can delete training manuals"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'training-manuals' 
  AND is_super_admin(auth.uid())
);