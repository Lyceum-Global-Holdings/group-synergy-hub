
-- Production Module Tables

-- 1. Production Sectors
CREATE TABLE public.production_sectors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid REFERENCES public.companies(id),
  name text NOT NULL,
  code text NOT NULL,
  description text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 2. Production Stage Templates
CREATE TABLE public.production_stage_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sector_id uuid NOT NULL REFERENCES public.production_sectors(id) ON DELETE CASCADE,
  company_id uuid REFERENCES public.companies(id),
  stage_name text NOT NULL,
  sequence_order integer NOT NULL,
  bom_categories jsonb DEFAULT '[]'::jsonb,
  description text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 3. Production Orders
CREATE TABLE public.production_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid REFERENCES public.companies(id),
  order_number text NOT NULL,
  sector_id uuid NOT NULL REFERENCES public.production_sectors(id),
  cpo_id uuid REFERENCES public.customer_purchase_orders(id),
  bom_id uuid REFERENCES public.bill_of_materials(id),
  product_name text NOT NULL,
  style_no text,
  target_qty integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'planned' CHECK (status IN ('planned','in_progress','completed','cancelled')),
  start_date date,
  due_date date,
  completed_date date,
  notes text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 4. Production Order Stages
CREATE TABLE public.production_order_stages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.production_orders(id) ON DELETE CASCADE,
  stage_template_id uuid REFERENCES public.production_stage_templates(id),
  stage_name text NOT NULL,
  sequence_order integer NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','in_progress','completed')),
  input_qty integer DEFAULT 0,
  output_qty integer DEFAULT 0,
  wastage_qty integer DEFAULT 0,
  started_at timestamptz,
  completed_at timestamptz,
  completed_by uuid,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 5. Production Stage Costs
CREATE TABLE public.production_stage_costs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  stage_id uuid NOT NULL REFERENCES public.production_order_stages(id) ON DELETE CASCADE,
  item_name text NOT NULL,
  bom_item_id uuid REFERENCES public.bom_items(id),
  unit_cost numeric(12,2) DEFAULT 0,
  quantity_used numeric(12,4) DEFAULT 0,
  total_cost numeric(12,2) DEFAULT 0,
  unit_of_measure text DEFAULT 'pcs',
  source text NOT NULL DEFAULT 'manual' CHECK (source IN ('bom','manual')),
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS on all tables
ALTER TABLE public.production_sectors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.production_stage_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.production_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.production_order_stages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.production_stage_costs ENABLE ROW LEVEL SECURITY;

-- RLS Policies using can_access_company
CREATE POLICY "Users can view production_sectors for their company" ON public.production_sectors FOR SELECT TO authenticated USING (can_access_company(company_id));
CREATE POLICY "Users can insert production_sectors for their company" ON public.production_sectors FOR INSERT TO authenticated WITH CHECK (can_access_company(company_id));
CREATE POLICY "Users can update production_sectors for their company" ON public.production_sectors FOR UPDATE TO authenticated USING (can_access_company(company_id));
CREATE POLICY "Users can delete production_sectors for their company" ON public.production_sectors FOR DELETE TO authenticated USING (can_access_company(company_id));

CREATE POLICY "Users can view production_stage_templates for their company" ON public.production_stage_templates FOR SELECT TO authenticated USING (can_access_company(company_id));
CREATE POLICY "Users can insert production_stage_templates for their company" ON public.production_stage_templates FOR INSERT TO authenticated WITH CHECK (can_access_company(company_id));
CREATE POLICY "Users can update production_stage_templates for their company" ON public.production_stage_templates FOR UPDATE TO authenticated USING (can_access_company(company_id));
CREATE POLICY "Users can delete production_stage_templates for their company" ON public.production_stage_templates FOR DELETE TO authenticated USING (can_access_company(company_id));

CREATE POLICY "Users can view production_orders for their company" ON public.production_orders FOR SELECT TO authenticated USING (can_access_company(company_id));
CREATE POLICY "Users can insert production_orders for their company" ON public.production_orders FOR INSERT TO authenticated WITH CHECK (can_access_company(company_id));
CREATE POLICY "Users can update production_orders for their company" ON public.production_orders FOR UPDATE TO authenticated USING (can_access_company(company_id));
CREATE POLICY "Users can delete production_orders for their company" ON public.production_orders FOR DELETE TO authenticated USING (can_access_company(company_id));

-- For order_stages and stage_costs, allow access via join to parent order's company_id
CREATE POLICY "Users can view production_order_stages" ON public.production_order_stages FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.production_orders po WHERE po.id = order_id AND can_access_company(po.company_id)));
CREATE POLICY "Users can insert production_order_stages" ON public.production_order_stages FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM public.production_orders po WHERE po.id = order_id AND can_access_company(po.company_id)));
CREATE POLICY "Users can update production_order_stages" ON public.production_order_stages FOR UPDATE TO authenticated USING (EXISTS (SELECT 1 FROM public.production_orders po WHERE po.id = order_id AND can_access_company(po.company_id)));
CREATE POLICY "Users can delete production_order_stages" ON public.production_order_stages FOR DELETE TO authenticated USING (EXISTS (SELECT 1 FROM public.production_orders po WHERE po.id = order_id AND can_access_company(po.company_id)));

CREATE POLICY "Users can view production_stage_costs" ON public.production_stage_costs FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.production_order_stages pos JOIN public.production_orders po ON po.id = pos.order_id WHERE pos.id = stage_id AND can_access_company(po.company_id)));
CREATE POLICY "Users can insert production_stage_costs" ON public.production_stage_costs FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM public.production_order_stages pos JOIN public.production_orders po ON po.id = pos.order_id WHERE pos.id = stage_id AND can_access_company(po.company_id)));
CREATE POLICY "Users can update production_stage_costs" ON public.production_stage_costs FOR UPDATE TO authenticated USING (EXISTS (SELECT 1 FROM public.production_order_stages pos JOIN public.production_orders po ON po.id = pos.order_id WHERE pos.id = stage_id AND can_access_company(po.company_id)));
CREATE POLICY "Users can delete production_stage_costs" ON public.production_stage_costs FOR DELETE TO authenticated USING (EXISTS (SELECT 1 FROM public.production_order_stages pos JOIN public.production_orders po ON po.id = pos.order_id WHERE pos.id = stage_id AND can_access_company(po.company_id)));

-- Auto-generate order_number
CREATE OR REPLACE FUNCTION public.generate_production_order_number()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  next_num integer;
BEGIN
  SELECT COALESCE(MAX(CAST(SUBSTRING(order_number FROM 5) AS integer)), 0) + 1
  INTO next_num
  FROM public.production_orders
  WHERE company_id = NEW.company_id;
  
  NEW.order_number := 'PRD-' || LPAD(next_num::text, 5, '0');
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_generate_production_order_number
  BEFORE INSERT ON public.production_orders
  FOR EACH ROW
  WHEN (NEW.order_number IS NULL OR NEW.order_number = '')
  EXECUTE FUNCTION public.generate_production_order_number();
