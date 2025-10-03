-- Create asset_master table for generic/template asset types
CREATE TABLE IF NOT EXISTS public.asset_master (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_name TEXT NOT NULL,
  brand TEXT,
  category_id UUID REFERENCES public.asset_categories(id) ON DELETE SET NULL,
  subcategory_id UUID REFERENCES public.asset_categories(id) ON DELETE SET NULL,
  purchase_price NUMERIC(15,2),
  current_value NUMERIC(15,2),
  image_url TEXT,
  description TEXT,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  company_id UUID,
  created_by UUID,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

-- Create asset_master_purchase_history table for tracking price history
CREATE TABLE IF NOT EXISTS public.asset_master_purchase_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_master_id UUID REFERENCES public.asset_master(id) ON DELETE CASCADE NOT NULL,
  purchase_price NUMERIC(15,2) NOT NULL,
  purchase_date DATE NOT NULL,
  vendor TEXT,
  quantity_purchased INTEGER,
  notes TEXT,
  created_by UUID,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

-- Add asset_master_id to warehouse_assets table
ALTER TABLE public.warehouse_assets 
ADD COLUMN IF NOT EXISTS asset_master_id UUID REFERENCES public.asset_master(id) ON DELETE SET NULL;

-- Enable RLS on asset_master
ALTER TABLE public.asset_master ENABLE ROW LEVEL SECURITY;

-- RLS Policies for asset_master
CREATE POLICY "Authenticated users can view asset master"
  ON public.asset_master FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Users can create asset master"
  ON public.asset_master FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL AND auth.uid() = created_by);

CREATE POLICY "Users can update their own asset master or admins can update any"
  ON public.asset_master FOR UPDATE
  USING (auth.uid() = created_by OR is_admin(auth.uid()));

CREATE POLICY "Admins can delete asset master"
  ON public.asset_master FOR DELETE
  USING (is_admin(auth.uid()));

-- Enable RLS on asset_master_purchase_history
ALTER TABLE public.asset_master_purchase_history ENABLE ROW LEVEL SECURITY;

-- RLS Policies for asset_master_purchase_history
CREATE POLICY "Authenticated users can view purchase history"
  ON public.asset_master_purchase_history FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Users can create purchase history"
  ON public.asset_master_purchase_history FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL AND auth.uid() = created_by);

CREATE POLICY "Users can update their own purchase history or admins can update any"
  ON public.asset_master_purchase_history FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.asset_master am
      WHERE am.id = asset_master_purchase_history.asset_master_id
      AND (am.created_by = auth.uid() OR is_admin(auth.uid()))
    )
  );

CREATE POLICY "Admins can delete purchase history"
  ON public.asset_master_purchase_history FOR DELETE
  USING (is_admin(auth.uid()));

-- Create storage bucket for asset images
INSERT INTO storage.buckets (id, name, public)
VALUES ('asset-images', 'asset-images', true)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for asset-images bucket
CREATE POLICY "Anyone can view asset images"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'asset-images');

CREATE POLICY "Authenticated users can upload asset images"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'asset-images' 
    AND auth.uid() IS NOT NULL
  );

CREATE POLICY "Users can update their own asset images"
  ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'asset-images' 
    AND auth.uid() IS NOT NULL
  );

CREATE POLICY "Users can delete their own asset images"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'asset-images' 
    AND auth.uid() IS NOT NULL
  );

-- Create index for better query performance
CREATE INDEX IF NOT EXISTS idx_asset_master_category ON public.asset_master(category_id);
CREATE INDEX IF NOT EXISTS idx_asset_master_subcategory ON public.asset_master(subcategory_id);
CREATE INDEX IF NOT EXISTS idx_asset_master_company ON public.asset_master(company_id);
CREATE INDEX IF NOT EXISTS idx_purchase_history_master ON public.asset_master_purchase_history(asset_master_id);
CREATE INDEX IF NOT EXISTS idx_warehouse_assets_master ON public.warehouse_assets(asset_master_id);

-- Trigger to update updated_at timestamp
CREATE TRIGGER update_asset_master_updated_at
  BEFORE UPDATE ON public.asset_master
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();