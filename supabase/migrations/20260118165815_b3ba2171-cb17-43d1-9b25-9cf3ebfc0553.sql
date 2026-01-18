-- Create item_batches table for tracking all batches
CREATE TABLE public.item_batches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  warehouse_item_id UUID NOT NULL REFERENCES public.warehouse_items(id) ON DELETE CASCADE,
  batch_number TEXT NOT NULL,
  manufacturing_date DATE,
  expiry_date DATE,
  quantity_received NUMERIC NOT NULL DEFAULT 0,
  quantity_remaining NUMERIC NOT NULL DEFAULT 0,
  unit_cost NUMERIC DEFAULT 0,
  grn_item_id UUID REFERENCES public.grn_items(id) ON DELETE SET NULL,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'depleted', 'expired', 'quarantine')),
  company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(warehouse_item_id, batch_number, company_id)
);

-- Create batch_stock_allocations table for bin-level tracking
CREATE TABLE public.batch_stock_allocations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id UUID NOT NULL REFERENCES public.item_batches(id) ON DELETE CASCADE,
  bin_id UUID NOT NULL REFERENCES public.warehouse_bins(id) ON DELETE CASCADE,
  allocated_quantity NUMERIC NOT NULL DEFAULT 0,
  company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(batch_id, bin_id)
);

-- Create batch_issue_details table for tracking consumed batches
CREATE TABLE public.batch_issue_details (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  issue_item_id UUID NOT NULL REFERENCES public.material_issue_items(id) ON DELETE CASCADE,
  batch_id UUID NOT NULL REFERENCES public.item_batches(id) ON DELETE CASCADE,
  quantity_from_batch NUMERIC NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add batch fields to grn_items
ALTER TABLE public.grn_items ADD COLUMN IF NOT EXISTS batch_number TEXT;
ALTER TABLE public.grn_items ADD COLUMN IF NOT EXISTS manufacturing_date DATE;
ALTER TABLE public.grn_items ADD COLUMN IF NOT EXISTS expiry_date DATE;

-- Add batch allocation mode to material_issue_items
ALTER TABLE public.material_issue_items ADD COLUMN IF NOT EXISTS batch_allocation_mode TEXT DEFAULT 'auto_fifo';

-- Enable RLS on new tables
ALTER TABLE public.item_batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.batch_stock_allocations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.batch_issue_details ENABLE ROW LEVEL SECURITY;

-- RLS policies for item_batches
CREATE POLICY "Users can view batches in their company" ON public.item_batches
  FOR SELECT USING (company_id IN (SELECT company_id FROM public.profiles WHERE id = auth.uid()));

CREATE POLICY "Users can insert batches in their company" ON public.item_batches
  FOR INSERT WITH CHECK (company_id IN (SELECT company_id FROM public.profiles WHERE id = auth.uid()));

CREATE POLICY "Users can update batches in their company" ON public.item_batches
  FOR UPDATE USING (company_id IN (SELECT company_id FROM public.profiles WHERE id = auth.uid()));

CREATE POLICY "Users can delete batches in their company" ON public.item_batches
  FOR DELETE USING (company_id IN (SELECT company_id FROM public.profiles WHERE id = auth.uid()));

-- RLS policies for batch_stock_allocations
CREATE POLICY "Users can view batch allocations in their company" ON public.batch_stock_allocations
  FOR SELECT USING (company_id IN (SELECT company_id FROM public.profiles WHERE id = auth.uid()));

CREATE POLICY "Users can insert batch allocations in their company" ON public.batch_stock_allocations
  FOR INSERT WITH CHECK (company_id IN (SELECT company_id FROM public.profiles WHERE id = auth.uid()));

CREATE POLICY "Users can update batch allocations in their company" ON public.batch_stock_allocations
  FOR UPDATE USING (company_id IN (SELECT company_id FROM public.profiles WHERE id = auth.uid()));

CREATE POLICY "Users can delete batch allocations in their company" ON public.batch_stock_allocations
  FOR DELETE USING (company_id IN (SELECT company_id FROM public.profiles WHERE id = auth.uid()));

-- RLS policies for batch_issue_details
CREATE POLICY "Users can view batch issue details" ON public.batch_issue_details
  FOR SELECT USING (EXISTS (
    SELECT 1 FROM public.material_issue_items mii
    JOIN public.material_issue_notes min ON min.id = mii.min_id
    WHERE mii.id = batch_issue_details.issue_item_id
    AND min.company_id IN (SELECT company_id FROM public.profiles WHERE id = auth.uid())
  ));

CREATE POLICY "Users can insert batch issue details" ON public.batch_issue_details
  FOR INSERT WITH CHECK (EXISTS (
    SELECT 1 FROM public.material_issue_items mii
    JOIN public.material_issue_notes min ON min.id = mii.min_id
    WHERE mii.id = batch_issue_details.issue_item_id
    AND min.company_id IN (SELECT company_id FROM public.profiles WHERE id = auth.uid())
  ));

-- Create trigger to auto-update batch status
CREATE OR REPLACE FUNCTION public.update_batch_status()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.quantity_remaining <= 0 THEN
    NEW.status := 'depleted';
  ELSIF NEW.expiry_date IS NOT NULL AND NEW.expiry_date < CURRENT_DATE THEN
    NEW.status := 'expired';
  ELSIF NEW.status = 'depleted' AND NEW.quantity_remaining > 0 THEN
    NEW.status := 'active';
  END IF;
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_batch_status
  BEFORE UPDATE ON public.item_batches
  FOR EACH ROW
  EXECUTE FUNCTION public.update_batch_status();

-- Create function to auto-create batches on GRN approval
CREATE OR REPLACE FUNCTION public.create_batches_on_grn_approval()
RETURNS TRIGGER AS $$
BEGIN
  -- Only run when status changes to 'approved' or 'completed'
  IF (NEW.status IN ('approved', 'completed') AND OLD.status NOT IN ('approved', 'completed')) THEN
    INSERT INTO public.item_batches (
      warehouse_item_id,
      batch_number,
      manufacturing_date,
      expiry_date,
      quantity_received,
      quantity_remaining,
      unit_cost,
      grn_item_id,
      company_id
    )
    SELECT 
      gi.warehouse_item_id,
      COALESCE(gi.batch_number, 'BATCH-' || to_char(NOW(), 'YYYYMMDD-HH24MISS') || '-' || SUBSTRING(gi.id::text, 1, 8)),
      gi.manufacturing_date,
      gi.expiry_date,
      gi.quantity_received,
      gi.quantity_received,
      gi.unit_price,
      gi.id,
      NEW.company_id
    FROM public.grn_items gi
    JOIN public.warehouse_items wi ON wi.id = gi.warehouse_item_id
    WHERE gi.grn_id = NEW.id
      AND gi.quality_status = 'good'
      AND gi.quantity_received > 0
      AND wi.is_batch_tracked = true
    ON CONFLICT (warehouse_item_id, batch_number, company_id) 
    DO UPDATE SET
      quantity_received = item_batches.quantity_received + EXCLUDED.quantity_received,
      quantity_remaining = item_batches.quantity_remaining + EXCLUDED.quantity_received,
      updated_at = NOW();
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_create_batches_on_grn_approval
  AFTER UPDATE ON public.goods_receipt_notes
  FOR EACH ROW
  EXECUTE FUNCTION public.create_batches_on_grn_approval();

-- Create indexes for performance
CREATE INDEX idx_item_batches_warehouse_item ON public.item_batches(warehouse_item_id);
CREATE INDEX idx_item_batches_status ON public.item_batches(status);
CREATE INDEX idx_item_batches_company ON public.item_batches(company_id);
CREATE INDEX idx_item_batches_expiry ON public.item_batches(expiry_date) WHERE expiry_date IS NOT NULL;
CREATE INDEX idx_item_batches_manufacturing ON public.item_batches(manufacturing_date);
CREATE INDEX idx_batch_stock_allocations_batch ON public.batch_stock_allocations(batch_id);
CREATE INDEX idx_batch_issue_details_issue_item ON public.batch_issue_details(issue_item_id);
CREATE INDEX idx_batch_issue_details_batch ON public.batch_issue_details(batch_id);