-- Create stock adjustment batches table
CREATE TABLE IF NOT EXISTS public.stock_adjustment_batches (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  batch_number TEXT NOT NULL UNIQUE,
  adjustment_date DATE NOT NULL DEFAULT CURRENT_DATE,
  adjustment_type TEXT NOT NULL DEFAULT 'physical_count',
  reason_category TEXT NOT NULL DEFAULT 'other',
  total_items INTEGER DEFAULT 0,
  total_value_impact NUMERIC(15,2) DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'draft',
  requires_approval BOOLEAN DEFAULT false,
  approval_threshold_exceeded BOOLEAN DEFAULT false,
  submitted_by UUID REFERENCES auth.users(id),
  submitted_date TIMESTAMP WITH TIME ZONE,
  approved_by UUID REFERENCES auth.users(id),
  approved_date TIMESTAMP WITH TIME ZONE,
  rejection_reason TEXT,
  company_id UUID,
  location_id UUID,
  notes TEXT,
  attachments JSONB DEFAULT '[]'::jsonb,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Add indexes
CREATE INDEX IF NOT EXISTS idx_stock_adjustment_batches_company ON public.stock_adjustment_batches(company_id);
CREATE INDEX IF NOT EXISTS idx_stock_adjustment_batches_status ON public.stock_adjustment_batches(status);
CREATE INDEX IF NOT EXISTS idx_stock_adjustment_batches_date ON public.stock_adjustment_batches(adjustment_date);

-- Add new columns to stock_transactions
ALTER TABLE public.stock_transactions ADD COLUMN IF NOT EXISTS batch_id UUID REFERENCES public.stock_adjustment_batches(id);
ALTER TABLE public.stock_transactions ADD COLUMN IF NOT EXISTS adjustment_reason TEXT;
ALTER TABLE public.stock_transactions ADD COLUMN IF NOT EXISTS approved_by UUID REFERENCES auth.users(id);
ALTER TABLE public.stock_transactions ADD COLUMN IF NOT EXISTS approved_date TIMESTAMP WITH TIME ZONE;

-- Create index for batch_id
CREATE INDEX IF NOT EXISTS idx_stock_transactions_batch_id ON public.stock_transactions(batch_id);

-- Enable RLS
ALTER TABLE public.stock_adjustment_batches ENABLE ROW LEVEL SECURITY;

-- RLS Policies for stock_adjustment_batches
CREATE POLICY "Users can view adjustment batches in their company"
  ON public.stock_adjustment_batches FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Users can create adjustment batches"
  ON public.stock_adjustment_batches FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL AND auth.uid() = created_by);

CREATE POLICY "Users can update their batches or admins can update any"
  ON public.stock_adjustment_batches FOR UPDATE
  USING (auth.uid() = created_by OR is_admin(auth.uid()));

CREATE POLICY "Admins can delete adjustment batches"
  ON public.stock_adjustment_batches FOR DELETE
  USING (is_admin(auth.uid()));

-- Function to generate adjustment batch number
CREATE OR REPLACE FUNCTION public.generate_adjustment_batch_number()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  next_number INTEGER;
  new_batch_number TEXT;
BEGIN
  SELECT COALESCE(MAX(CAST(SUBSTRING(batch_number FROM 'ADJ-' || TO_CHAR(CURRENT_DATE, 'YYYYMMDD') || '-(.*)') AS INTEGER)), 0) + 1
  INTO next_number
  FROM stock_adjustment_batches
  WHERE batch_number LIKE 'ADJ-' || TO_CHAR(CURRENT_DATE, 'YYYYMMDD') || '-%';
  
  new_batch_number := 'ADJ-' || TO_CHAR(CURRENT_DATE, 'YYYYMMDD') || '-' || LPAD(next_number::TEXT, 3, '0');
  RETURN new_batch_number;
END;
$$;

-- Trigger to auto-generate batch number
CREATE OR REPLACE FUNCTION public.auto_generate_adjustment_batch_number()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.batch_number IS NULL OR NEW.batch_number = '' THEN
    NEW.batch_number := generate_adjustment_batch_number();
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trigger_auto_generate_adjustment_batch_number
  BEFORE INSERT ON public.stock_adjustment_batches
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_generate_adjustment_batch_number();

-- Trigger to update batch totals when transactions change
CREATE OR REPLACE FUNCTION public.update_batch_totals()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  UPDATE public.stock_adjustment_batches
  SET 
    total_items = (SELECT COUNT(*) FROM stock_transactions WHERE batch_id = COALESCE(NEW.batch_id, OLD.batch_id)),
    total_value_impact = (SELECT COALESCE(SUM(total_value), 0) FROM stock_transactions WHERE batch_id = COALESCE(NEW.batch_id, OLD.batch_id)),
    updated_at = now()
  WHERE id = COALESCE(NEW.batch_id, OLD.batch_id);
  
  RETURN COALESCE(NEW, OLD);
END;
$$;

CREATE TRIGGER trigger_update_batch_totals_insert
  AFTER INSERT ON public.stock_transactions
  FOR EACH ROW
  WHEN (NEW.batch_id IS NOT NULL)
  EXECUTE FUNCTION public.update_batch_totals();

CREATE TRIGGER trigger_update_batch_totals_update
  AFTER UPDATE ON public.stock_transactions
  FOR EACH ROW
  WHEN (NEW.batch_id IS NOT NULL OR OLD.batch_id IS NOT NULL)
  EXECUTE FUNCTION public.update_batch_totals();

CREATE TRIGGER trigger_update_batch_totals_delete
  AFTER DELETE ON public.stock_transactions
  FOR EACH ROW
  WHEN (OLD.batch_id IS NOT NULL)
  EXECUTE FUNCTION public.update_batch_totals();

-- View for adjustment summary by item
CREATE OR REPLACE VIEW v_adjustment_summary_by_item AS
SELECT 
  wi.id,
  wi.name,
  wi.item_code,
  wi.company_id,
  COUNT(DISTINCT st.id) as total_adjustments,
  SUM(CASE WHEN st.quantity_change > 0 THEN st.quantity_change ELSE 0 END) as total_increases,
  SUM(CASE WHEN st.quantity_change < 0 THEN ABS(st.quantity_change) ELSE 0 END) as total_decreases,
  SUM(CASE WHEN st.quantity_change > 0 THEN st.total_value ELSE 0 END) as value_increases,
  SUM(CASE WHEN st.quantity_change < 0 THEN ABS(st.total_value) ELSE 0 END) as value_decreases,
  MAX(st.created_at) as last_adjustment_date
FROM warehouse_items wi
LEFT JOIN stock_transactions st ON wi.id = st.item_id
WHERE st.transaction_type = 'adjustment'
GROUP BY wi.id, wi.name, wi.item_code, wi.company_id;

-- View for adjustment trends
CREATE OR REPLACE VIEW v_adjustment_trends AS
SELECT 
  DATE_TRUNC('month', st.created_at) as month,
  st.company_id,
  COUNT(*) as adjustment_count,
  SUM(ABS(st.total_value)) as total_value_impact,
  COUNT(DISTINCT st.item_id) as items_affected,
  SUM(CASE WHEN st.quantity_change > 0 THEN 1 ELSE 0 END) as increases_count,
  SUM(CASE WHEN st.quantity_change < 0 THEN 1 ELSE 0 END) as decreases_count
FROM stock_transactions st
WHERE st.transaction_type = 'adjustment'
GROUP BY DATE_TRUNC('month', st.created_at), st.company_id;

-- Update trigger for updated_at
CREATE TRIGGER trigger_update_stock_adjustment_batches_updated_at
  BEFORE UPDATE ON public.stock_adjustment_batches
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();