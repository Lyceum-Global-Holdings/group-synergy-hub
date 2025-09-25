-- Create supplier evaluations table
CREATE TABLE public.supplier_evaluations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  evaluation_number TEXT NOT NULL,
  supplier_id UUID REFERENCES public.suppliers(id) NOT NULL,
  product_name TEXT NOT NULL,
  evaluation_period_start DATE NOT NULL,
  evaluation_period_end DATE NOT NULL,
  total_deliveries INTEGER NOT NULL DEFAULT 0,
  total_points_achieved NUMERIC(10,2) NOT NULL DEFAULT 0,
  total_possible_points NUMERIC(10,2) NOT NULL DEFAULT 0,
  performance_rate NUMERIC(5,2) NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'completed', 'archived')),
  evaluated_by UUID,
  company_id UUID,
  created_by UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create supplier evaluation entries table
CREATE TABLE public.supplier_evaluation_entries (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  evaluation_id UUID REFERENCES public.supplier_evaluations(id) ON DELETE CASCADE NOT NULL,
  receipt_date DATE NOT NULL,
  po_delivery_date DATE NOT NULL,
  po_number TEXT,
  -- Product Quality Scores (boolean flags)
  passed_first_time BOOLEAN DEFAULT FALSE,
  passed_after_rework BOOLEAN DEFAULT FALSE,
  failed_but_accepted BOOLEAN DEFAULT FALSE,
  failed_returned BOOLEAN DEFAULT FALSE,
  -- Punctuality Scores (boolean flags)
  within_due_date BOOLEAN DEFAULT FALSE,
  five_days_late BOOLEAN DEFAULT FALSE,
  within_14_days BOOLEAN DEFAULT FALSE,
  over_14_days_late BOOLEAN DEFAULT FALSE,
  -- Calculated scores
  quality_score NUMERIC(5,2) NOT NULL DEFAULT 0,
  punctuality_score NUMERIC(5,2) NOT NULL DEFAULT 0,
  total_score NUMERIC(5,2) NOT NULL DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.supplier_evaluations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.supplier_evaluation_entries ENABLE ROW LEVEL SECURITY;

-- RLS Policies for supplier_evaluations
CREATE POLICY "Authenticated users can view supplier evaluations"
ON public.supplier_evaluations FOR SELECT
USING (auth.uid() IS NOT NULL);

CREATE POLICY "Users can create supplier evaluations"
ON public.supplier_evaluations FOR INSERT
WITH CHECK (auth.uid() IS NOT NULL AND auth.uid() = created_by);

CREATE POLICY "Users can update evaluations they created or admins can update any"
ON public.supplier_evaluations FOR UPDATE
USING (auth.uid() = created_by OR is_admin(auth.uid()));

CREATE POLICY "Admins can delete supplier evaluations"
ON public.supplier_evaluations FOR DELETE
USING (is_admin(auth.uid()));

-- RLS Policies for supplier_evaluation_entries
CREATE POLICY "Users can view evaluation entries they have access to"
ON public.supplier_evaluation_entries FOR SELECT
USING (EXISTS (
  SELECT 1 FROM supplier_evaluations se 
  WHERE se.id = supplier_evaluation_entries.evaluation_id 
  AND (se.created_by = auth.uid() OR is_admin(auth.uid()))
));

CREATE POLICY "Users can manage entries for their own evaluations"
ON public.supplier_evaluation_entries FOR ALL
USING (EXISTS (
  SELECT 1 FROM supplier_evaluations se 
  WHERE se.id = supplier_evaluation_entries.evaluation_id 
  AND (se.created_by = auth.uid() OR is_admin(auth.uid()))
));

-- Function to generate evaluation number
CREATE OR REPLACE FUNCTION public.generate_evaluation_number()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  next_number INTEGER;
  new_evaluation_number TEXT;
BEGIN
  -- Get the next sequence number for this year
  SELECT COALESCE(MAX(CAST(SUBSTRING(evaluation_number FROM 'EVAL-' || TO_CHAR(CURRENT_DATE, 'YYYY') || '-(.*)') AS INTEGER)), 0) + 1
  INTO next_number
  FROM supplier_evaluations
  WHERE evaluation_number LIKE 'EVAL-' || TO_CHAR(CURRENT_DATE, 'YYYY') || '-%';
  
  -- Generate evaluation number: EVAL-YYYY-001
  new_evaluation_number := 'EVAL-' || TO_CHAR(CURRENT_DATE, 'YYYY') || '-' || LPAD(next_number::TEXT, 3, '0');
  
  RETURN new_evaluation_number;
END;
$$;

-- Function to auto-generate evaluation number
CREATE OR REPLACE FUNCTION public.auto_generate_evaluation_number()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Only generate if evaluation_number is not already set
  IF NEW.evaluation_number IS NULL OR NEW.evaluation_number = '' THEN
    NEW.evaluation_number := generate_evaluation_number();
  END IF;
  RETURN NEW;
END;
$$;

-- Function to calculate entry scores
CREATE OR REPLACE FUNCTION public.calculate_evaluation_entry_scores()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  -- Calculate quality score
  IF NEW.passed_first_time THEN
    NEW.quality_score := 50;
  ELSIF NEW.passed_after_rework THEN
    NEW.quality_score := 30;
  ELSIF NEW.failed_but_accepted THEN
    NEW.quality_score := 20;
  ELSIF NEW.failed_returned THEN
    NEW.quality_score := 0;
  ELSE
    NEW.quality_score := 0;
  END IF;
  
  -- Calculate punctuality score based on delivery timing
  IF NEW.within_due_date THEN
    NEW.punctuality_score := 50;
  ELSIF NEW.five_days_late THEN
    NEW.punctuality_score := 30;
  ELSIF NEW.within_14_days THEN
    NEW.punctuality_score := 20;
  ELSIF NEW.over_14_days_late THEN
    NEW.punctuality_score := 0;
  ELSE
    NEW.punctuality_score := 0;
  END IF;
  
  -- Calculate total score
  NEW.total_score := NEW.quality_score + NEW.punctuality_score;
  
  RETURN NEW;
END;
$$;

-- Function to update evaluation totals
CREATE OR REPLACE FUNCTION public.update_supplier_evaluation_totals()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
DECLARE
  evaluation_totals RECORD;
BEGIN
  -- Calculate totals from all entries for the evaluation
  SELECT 
    COUNT(*) as total_deliveries,
    COALESCE(SUM(total_score), 0) as total_points_achieved,
    COUNT(*) * 100 as total_possible_points,
    CASE 
      WHEN COUNT(*) > 0 THEN ROUND((COALESCE(SUM(total_score), 0) / (COUNT(*) * 100)) * 100, 2)
      ELSE 0
    END as performance_rate
  INTO evaluation_totals
  FROM supplier_evaluation_entries
  WHERE evaluation_id = COALESCE(NEW.evaluation_id, OLD.evaluation_id);
  
  -- Update the evaluation totals
  UPDATE supplier_evaluations
  SET 
    total_deliveries = evaluation_totals.total_deliveries,
    total_points_achieved = evaluation_totals.total_points_achieved,
    total_possible_points = evaluation_totals.total_possible_points,
    performance_rate = evaluation_totals.performance_rate,
    updated_at = now()
  WHERE id = COALESCE(NEW.evaluation_id, OLD.evaluation_id);
  
  RETURN COALESCE(NEW, OLD);
END;
$$;

-- Create triggers
CREATE TRIGGER auto_generate_evaluation_number_trigger
BEFORE INSERT ON public.supplier_evaluations
FOR EACH ROW
EXECUTE FUNCTION public.auto_generate_evaluation_number();

CREATE TRIGGER calculate_entry_scores_trigger
BEFORE INSERT OR UPDATE ON public.supplier_evaluation_entries
FOR EACH ROW
EXECUTE FUNCTION public.calculate_evaluation_entry_scores();

CREATE TRIGGER update_evaluation_totals_trigger
AFTER INSERT OR UPDATE OR DELETE ON public.supplier_evaluation_entries
FOR EACH ROW
EXECUTE FUNCTION public.update_supplier_evaluation_totals();

-- Create indexes for better performance
CREATE INDEX idx_supplier_evaluations_supplier_id ON public.supplier_evaluations(supplier_id);
CREATE INDEX idx_supplier_evaluations_status ON public.supplier_evaluations(status);
CREATE INDEX idx_supplier_evaluations_period ON public.supplier_evaluations(evaluation_period_start, evaluation_period_end);
CREATE INDEX idx_supplier_evaluation_entries_evaluation_id ON public.supplier_evaluation_entries(evaluation_id);
CREATE INDEX idx_supplier_evaluation_entries_receipt_date ON public.supplier_evaluation_entries(receipt_date);