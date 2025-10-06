-- Create supplier recommendations table
CREATE TABLE IF NOT EXISTS public.supplier_recommendations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  supplier_id UUID NOT NULL REFERENCES public.suppliers(id) ON DELETE CASCADE,
  recommendation_type TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  priority TEXT NOT NULL DEFAULT 'medium',
  potential_savings NUMERIC(10,2),
  risk_level TEXT,
  action_taken BOOLEAN DEFAULT false,
  action_taken_at TIMESTAMP WITH TIME ZONE,
  action_taken_by UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  expires_at TIMESTAMP WITH TIME ZONE,
  company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE
);

-- Create supplier action items table
CREATE TABLE IF NOT EXISTS public.supplier_action_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  supplier_id UUID NOT NULL REFERENCES public.suppliers(id) ON DELETE CASCADE,
  recommendation_id UUID REFERENCES public.supplier_recommendations(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  description TEXT,
  assigned_to UUID,
  status TEXT NOT NULL DEFAULT 'pending',
  priority TEXT NOT NULL DEFAULT 'medium',
  due_date DATE,
  completed_at TIMESTAMP WITH TIME ZONE,
  completed_by UUID,
  notes TEXT,
  company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE,
  created_by UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create evaluation rules table
CREATE TABLE IF NOT EXISTS public.evaluation_rules (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  rule_name TEXT NOT NULL,
  rule_type TEXT NOT NULL,
  threshold_value NUMERIC(10,2) NOT NULL,
  comparison_operator TEXT NOT NULL,
  action_type TEXT NOT NULL,
  is_active BOOLEAN DEFAULT true,
  company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE,
  created_by UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.supplier_recommendations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.supplier_action_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.evaluation_rules ENABLE ROW LEVEL SECURITY;

-- RLS Policies for supplier_recommendations
CREATE POLICY "Authenticated users can view recommendations"
  ON public.supplier_recommendations FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Users can create recommendations"
  ON public.supplier_recommendations FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Users can update recommendations"
  ON public.supplier_recommendations FOR UPDATE
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Admins can delete recommendations"
  ON public.supplier_recommendations FOR DELETE
  USING (is_admin(auth.uid()));

-- RLS Policies for supplier_action_items
CREATE POLICY "Authenticated users can view action items"
  ON public.supplier_action_items FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Users can create action items"
  ON public.supplier_action_items FOR INSERT
  WITH CHECK ((auth.uid() IS NOT NULL) AND (auth.uid() = created_by));

CREATE POLICY "Users can update their action items or admins can update any"
  ON public.supplier_action_items FOR UPDATE
  USING ((auth.uid() = created_by) OR (auth.uid() = assigned_to) OR is_admin(auth.uid()));

CREATE POLICY "Admins can delete action items"
  ON public.supplier_action_items FOR DELETE
  USING (is_admin(auth.uid()));

-- RLS Policies for evaluation_rules
CREATE POLICY "Authenticated users can view rules"
  ON public.evaluation_rules FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Admins can manage rules"
  ON public.evaluation_rules FOR ALL
  USING (is_admin(auth.uid()));

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_supplier_recommendations_supplier 
  ON public.supplier_recommendations(supplier_id);
CREATE INDEX IF NOT EXISTS idx_supplier_recommendations_type 
  ON public.supplier_recommendations(recommendation_type);
CREATE INDEX IF NOT EXISTS idx_supplier_action_items_supplier 
  ON public.supplier_action_items(supplier_id);
CREATE INDEX IF NOT EXISTS idx_supplier_action_items_status 
  ON public.supplier_action_items(status);
CREATE INDEX IF NOT EXISTS idx_evaluation_rules_active 
  ON public.evaluation_rules(is_active);