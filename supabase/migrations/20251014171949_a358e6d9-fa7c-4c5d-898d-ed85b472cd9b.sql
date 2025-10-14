-- Create product_colors table
CREATE TABLE public.product_colors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  color_name TEXT NOT NULL UNIQUE,
  color_code TEXT,
  hex_value TEXT,
  is_active BOOLEAN DEFAULT true,
  company_id UUID REFERENCES companies(id),
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

COMMENT ON TABLE product_colors IS 'Master list of available product colors';

CREATE INDEX idx_product_colors_company ON product_colors(company_id);
CREATE INDEX idx_product_colors_active ON product_colors(is_active);

-- RLS Policies for product_colors
ALTER TABLE product_colors ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view colors" ON product_colors FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Users can create colors" ON product_colors FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL AND auth.uid() = created_by);

CREATE POLICY "Admins can manage colors" ON product_colors FOR ALL
  USING (is_admin(auth.uid()));

-- Create product_master table
CREATE TABLE public.product_master (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_code TEXT NOT NULL UNIQUE,
  product_name TEXT NOT NULL,
  style_no TEXT,
  description TEXT,
  category_id UUID REFERENCES item_categories(id),
  subcategory_id UUID REFERENCES item_categories(id),
  available_colors JSONB DEFAULT '[]'::jsonb,
  available_sizes JSONB DEFAULT '[]'::jsonb,
  unit_of_measure TEXT DEFAULT 'pcs',
  base_price NUMERIC(15,2),
  image_url TEXT,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'discontinued')),
  company_id UUID REFERENCES companies(id),
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

COMMENT ON TABLE product_master IS 'Master product definitions with variants';
COMMENT ON COLUMN product_master.available_colors IS 'Array of color names from product_colors';
COMMENT ON COLUMN product_master.available_sizes IS 'Array of available size options';

CREATE INDEX idx_product_master_company ON product_master(company_id);
CREATE INDEX idx_product_master_category ON product_master(category_id);
CREATE INDEX idx_product_master_status ON product_master(status);
CREATE INDEX idx_product_master_style ON product_master(style_no);

-- RLS Policies for product_master
ALTER TABLE product_master ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view product master" ON product_master FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Users can create product master" ON product_master FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL AND auth.uid() = created_by);

CREATE POLICY "Users can update their product master or admins can update" ON product_master FOR UPDATE
  USING (auth.uid() = created_by OR is_admin(auth.uid()));

CREATE POLICY "Admins can delete product master" ON product_master FOR DELETE
  USING (is_admin(auth.uid()));

-- Update finished_goods table
ALTER TABLE public.finished_goods
ADD COLUMN product_master_id UUID REFERENCES product_master(id) ON DELETE SET NULL,
ADD COLUMN variant_code TEXT,
ADD COLUMN is_variant BOOLEAN DEFAULT false;

COMMENT ON COLUMN finished_goods.color IS 'Specific color for this variant';
COMMENT ON COLUMN finished_goods.size IS 'Specific size for this variant';
COMMENT ON COLUMN finished_goods.product_master_id IS 'Link to parent product master';
COMMENT ON COLUMN finished_goods.variant_code IS 'Unique variant identifier (e.g., BLU-XL)';

CREATE INDEX idx_finished_goods_product_master ON finished_goods(product_master_id);
CREATE INDEX idx_finished_goods_variant ON finished_goods(product_master_id, color, size);