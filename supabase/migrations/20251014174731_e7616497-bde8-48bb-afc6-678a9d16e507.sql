-- Create product_colors table for color master data
CREATE TABLE IF NOT EXISTS public.product_colors (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  color_name TEXT NOT NULL UNIQUE,
  color_code TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  company_id UUID REFERENCES public.companies(id),
  created_by UUID
);

-- Create product_master table
CREATE TABLE IF NOT EXISTS public.product_master (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  product_name TEXT NOT NULL,
  product_code TEXT NOT NULL UNIQUE,
  style_no TEXT,
  category_id UUID REFERENCES public.item_categories(id),
  description TEXT,
  available_colors JSONB DEFAULT '[]'::jsonb,
  available_sizes JSONB DEFAULT '[]'::jsonb,
  default_unit_of_measure TEXT DEFAULT 'pcs',
  image_url TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  created_by UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  company_id UUID REFERENCES public.companies(id)
);

-- Add columns to finished_goods table if they don't exist
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'finished_goods' AND column_name = 'product_master_id') THEN
    ALTER TABLE public.finished_goods ADD COLUMN product_master_id UUID REFERENCES public.product_master(id);
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'finished_goods' AND column_name = 'variant_code') THEN
    ALTER TABLE public.finished_goods ADD COLUMN variant_code TEXT;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'finished_goods' AND column_name = 'is_variant') THEN
    ALTER TABLE public.finished_goods ADD COLUMN is_variant BOOLEAN DEFAULT false;
  END IF;
END $$;

-- Enable RLS on product_colors
ALTER TABLE public.product_colors ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist and recreate them
DROP POLICY IF EXISTS "Authenticated users can view product colors" ON public.product_colors;
CREATE POLICY "Authenticated users can view product colors"
ON public.product_colors FOR SELECT
USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Authenticated users can create product colors" ON public.product_colors;
CREATE POLICY "Authenticated users can create product colors"
ON public.product_colors FOR INSERT
WITH CHECK (auth.uid() IS NOT NULL AND auth.uid() = created_by);

DROP POLICY IF EXISTS "Users can update colors they created or admins can update any" ON public.product_colors;
CREATE POLICY "Users can update colors they created or admins can update any"
ON public.product_colors FOR UPDATE
USING (auth.uid() = created_by OR is_admin(auth.uid()));

DROP POLICY IF EXISTS "Admins can delete product colors" ON public.product_colors;
CREATE POLICY "Admins can delete product colors"
ON public.product_colors FOR DELETE
USING (is_admin(auth.uid()));

-- Enable RLS on product_master
ALTER TABLE public.product_master ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist and recreate them
DROP POLICY IF EXISTS "Authenticated users can view product master" ON public.product_master;
CREATE POLICY "Authenticated users can view product master"
ON public.product_master FOR SELECT
USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Authenticated users can create product master" ON public.product_master;
CREATE POLICY "Authenticated users can create product master"
ON public.product_master FOR INSERT
WITH CHECK (auth.uid() IS NOT NULL AND auth.uid() = created_by);

DROP POLICY IF EXISTS "Users can update product master they created or admins can update any" ON public.product_master;
CREATE POLICY "Users can update product master they created or admins can update any"
ON public.product_master FOR UPDATE
USING (auth.uid() = created_by OR is_admin(auth.uid()));

DROP POLICY IF EXISTS "Admins can delete product master" ON public.product_master;
CREATE POLICY "Admins can delete product master"
ON public.product_master FOR DELETE
USING (is_admin(auth.uid()));

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_product_master_company ON public.product_master(company_id);
CREATE INDEX IF NOT EXISTS idx_product_master_category ON public.product_master(category_id);
CREATE INDEX IF NOT EXISTS idx_product_master_status ON public.product_master(status);
CREATE INDEX IF NOT EXISTS idx_product_colors_company ON public.product_colors(company_id);
CREATE INDEX IF NOT EXISTS idx_finished_goods_product_master ON public.finished_goods(product_master_id);