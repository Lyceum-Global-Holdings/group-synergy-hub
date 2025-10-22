-- Create inventory valuation methods table
CREATE TABLE IF NOT EXISTS public.inventory_valuation_methods (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE,
  item_type TEXT NOT NULL CHECK (item_type IN ('raw_material', 'finished_good', 'asset')),
  item_id UUID,
  valuation_method TEXT NOT NULL CHECK (valuation_method IN ('fifo', 'lifo', 'weighted_average', 'standard_cost', 'actual_cost')),
  is_default BOOLEAN DEFAULT false,
  effective_from DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  created_by UUID REFERENCES auth.users(id),
  UNIQUE(company_id, item_type, item_id)
);

-- Create inventory snapshots table
CREATE TABLE IF NOT EXISTS public.inventory_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE,
  snapshot_date DATE NOT NULL,
  snapshot_type TEXT NOT NULL CHECK (snapshot_type IN ('daily', 'monthly', 'year_end', 'manual')),
  total_inventory_value NUMERIC(15,2) DEFAULT 0,
  raw_materials_value NUMERIC(15,2) DEFAULT 0,
  finished_goods_value NUMERIC(15,2) DEFAULT 0,
  assets_value NUMERIC(15,2) DEFAULT 0,
  item_count INTEGER DEFAULT 0,
  snapshot_data JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  created_by UUID REFERENCES auth.users(id),
  UNIQUE(company_id, snapshot_date, snapshot_type)
);

-- Create cost layers table for FIFO/LIFO
CREATE TABLE IF NOT EXISTS public.cost_layers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id UUID NOT NULL,
  item_type TEXT NOT NULL CHECK (item_type IN ('raw_material', 'finished_good')),
  transaction_id UUID,
  quantity_received NUMERIC(15,3) NOT NULL,
  quantity_remaining NUMERIC(15,3) NOT NULL,
  unit_cost NUMERIC(15,2) NOT NULL,
  total_cost NUMERIC(15,2) NOT NULL,
  receipt_date TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  layer_status TEXT DEFAULT 'active' CHECK (layer_status IN ('active', 'exhausted')),
  company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create inventory valuation reports table
CREATE TABLE IF NOT EXISTS public.inventory_valuation_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE,
  report_name TEXT NOT NULL,
  report_type TEXT NOT NULL CHECK (report_type IN ('summary', 'detailed', 'aging', 'comparison', 'movement')),
  filters JSONB,
  generated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  generated_by UUID REFERENCES auth.users(id),
  report_data JSONB,
  is_pinned BOOLEAN DEFAULT false
);

-- Enable RLS
ALTER TABLE public.inventory_valuation_methods ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cost_layers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_valuation_reports ENABLE ROW LEVEL SECURITY;

-- RLS Policies for inventory_valuation_methods
CREATE POLICY "Users can view their company's valuation methods"
  ON public.inventory_valuation_methods FOR SELECT
  USING (company_id = ANY(get_user_company_ids(auth.uid())));

CREATE POLICY "Users can create valuation methods for their company"
  ON public.inventory_valuation_methods FOR INSERT
  WITH CHECK (company_id = ANY(get_user_company_ids(auth.uid())));

CREATE POLICY "Users can update their company's valuation methods"
  ON public.inventory_valuation_methods FOR UPDATE
  USING (company_id = ANY(get_user_company_ids(auth.uid())));

-- RLS Policies for inventory_snapshots
CREATE POLICY "Users can view their company's snapshots"
  ON public.inventory_snapshots FOR SELECT
  USING (company_id = ANY(get_user_company_ids(auth.uid())));

CREATE POLICY "Users can create snapshots for their company"
  ON public.inventory_snapshots FOR INSERT
  WITH CHECK (company_id = ANY(get_user_company_ids(auth.uid())));

-- RLS Policies for cost_layers
CREATE POLICY "Users can view their company's cost layers"
  ON public.cost_layers FOR SELECT
  USING (company_id = ANY(get_user_company_ids(auth.uid())));

CREATE POLICY "Users can create cost layers for their company"
  ON public.cost_layers FOR INSERT
  WITH CHECK (company_id = ANY(get_user_company_ids(auth.uid())));

CREATE POLICY "Users can update their company's cost layers"
  ON public.cost_layers FOR UPDATE
  USING (company_id = ANY(get_user_company_ids(auth.uid())));

-- RLS Policies for inventory_valuation_reports
CREATE POLICY "Users can view their company's valuation reports"
  ON public.inventory_valuation_reports FOR SELECT
  USING (company_id = ANY(get_user_company_ids(auth.uid())));

CREATE POLICY "Users can create valuation reports for their company"
  ON public.inventory_valuation_reports FOR INSERT
  WITH CHECK (company_id = ANY(get_user_company_ids(auth.uid())));

CREATE POLICY "Users can delete their own valuation reports"
  ON public.inventory_valuation_reports FOR DELETE
  USING (company_id = ANY(get_user_company_ids(auth.uid())) AND generated_by = auth.uid());

-- Create indexes for performance
CREATE INDEX idx_valuation_methods_company ON public.inventory_valuation_methods(company_id);
CREATE INDEX idx_snapshots_company_date ON public.inventory_snapshots(company_id, snapshot_date DESC);
CREATE INDEX idx_cost_layers_item ON public.cost_layers(item_id, item_type, layer_status);
CREATE INDEX idx_cost_layers_company ON public.cost_layers(company_id);
CREATE INDEX idx_valuation_reports_company ON public.inventory_valuation_reports(company_id, generated_at DESC);

-- Create function to calculate inventory valuation
CREATE OR REPLACE FUNCTION public.calculate_inventory_valuation(
  p_company_id UUID,
  p_valuation_date DATE DEFAULT CURRENT_DATE,
  p_item_types TEXT[] DEFAULT ARRAY['raw_material', 'finished_good', 'asset'],
  p_category_ids UUID[] DEFAULT NULL,
  p_location_ids UUID[] DEFAULT NULL
)
RETURNS TABLE (
  item_id UUID,
  item_code TEXT,
  item_name TEXT,
  item_type TEXT,
  category TEXT,
  location TEXT,
  quantity_on_hand NUMERIC,
  unit_cost NUMERIC,
  total_value NUMERIC,
  valuation_method TEXT,
  days_in_stock INTEGER,
  aging_bucket TEXT,
  last_movement_date TIMESTAMP WITH TIME ZONE
) 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  WITH raw_materials AS (
    SELECT 
      wi.id,
      wi.item_code,
      wi.item_name,
      'raw_material'::TEXT as type,
      COALESCE(ic.category_name, 'Uncategorized') as cat,
      COALESCE(wl.location_name, 'Default') as loc,
      COALESCE(wi.current_stock, 0) as qty,
      COALESCE(wi.unit_price, 0) as cost,
      COALESCE(wi.current_stock, 0) * COALESCE(wi.unit_price, 0) as value,
      COALESCE(ivm.valuation_method, 'weighted_average') as method,
      EXTRACT(DAY FROM (p_valuation_date - COALESCE(
        (SELECT MAX(created_at)::DATE FROM stock_transactions WHERE item_id = wi.id),
        wi.created_at::DATE
      )))::INTEGER as days,
      COALESCE(
        (SELECT MAX(created_at) FROM stock_transactions WHERE item_id = wi.id),
        wi.created_at
      ) as last_move
    FROM warehouse_items wi
    LEFT JOIN item_categories ic ON wi.category_id = ic.id
    LEFT JOIN warehouse_locations wl ON wi.location_id = wl.id
    LEFT JOIN inventory_valuation_methods ivm ON ivm.item_id = wi.id AND ivm.item_type = 'raw_material'
    WHERE wi.company_id = p_company_id
      AND (p_category_ids IS NULL OR wi.category_id = ANY(p_category_ids))
      AND (p_location_ids IS NULL OR wi.location_id = ANY(p_location_ids))
      AND 'raw_material' = ANY(p_item_types)
  ),
  finished_goods AS (
    SELECT 
      fg.id,
      fg.product_code,
      fg.product_name,
      'finished_good'::TEXT as type,
      'Finished Goods' as cat,
      'Warehouse' as loc,
      COALESCE(fg.current_stock, 0) as qty,
      COALESCE(fg.selling_price, 0) as cost,
      COALESCE(fg.current_stock, 0) * COALESCE(fg.selling_price, 0) as value,
      COALESCE(ivm.valuation_method, 'weighted_average') as method,
      EXTRACT(DAY FROM (p_valuation_date - COALESCE(
        (SELECT MAX(created_at)::DATE FROM finished_goods_movements WHERE finished_good_id = fg.id),
        fg.created_at::DATE
      )))::INTEGER as days,
      COALESCE(
        (SELECT MAX(created_at) FROM finished_goods_movements WHERE finished_good_id = fg.id),
        fg.created_at
      ) as last_move
    FROM finished_goods fg
    LEFT JOIN inventory_valuation_methods ivm ON ivm.item_id = fg.id AND ivm.item_type = 'finished_good'
    WHERE fg.company_id = p_company_id
      AND 'finished_good' = ANY(p_item_types)
  ),
  combined AS (
    SELECT * FROM raw_materials
    UNION ALL
    SELECT * FROM finished_goods
  )
  SELECT 
    c.id,
    c.item_code,
    c.item_name,
    c.type,
    c.cat,
    c.loc,
    c.qty,
    c.cost,
    c.value,
    c.method,
    c.days,
    CASE 
      WHEN c.days <= 30 THEN '0-30 days'
      WHEN c.days <= 90 THEN '31-90 days'
      WHEN c.days <= 180 THEN '91-180 days'
      WHEN c.days <= 365 THEN '181-365 days'
      ELSE '365+ days'
    END as aging,
    c.last_move
  FROM combined c
  WHERE c.qty > 0
  ORDER BY c.value DESC;
END;
$$;