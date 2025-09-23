-- Enhanced GRN functionality with standalone GRN support

-- Create GRN header table for standalone GRNs (not just PO-linked)
CREATE TABLE IF NOT EXISTS public.goods_receipt_notes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  grn_number TEXT NOT NULL UNIQUE,
  grn_date DATE NOT NULL DEFAULT CURRENT_DATE,
  invoice_number TEXT,
  invoice_date DATE,
  po_id UUID REFERENCES public.purchase_orders(id),
  po_number TEXT,
  pr_number TEXT,
  mr_number TEXT,
  supplier_id UUID REFERENCES public.suppliers(id),
  supplier_name TEXT NOT NULL,
  supplier_address TEXT,
  branch TEXT,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'submitted', 'approved', 'completed')),
  total_value NUMERIC(15,2) DEFAULT 0,
  remarks TEXT,
  received_by UUID REFERENCES auth.users(id),
  approved_by UUID REFERENCES auth.users(id),
  approved_date TIMESTAMP WITH TIME ZONE,
  company_id UUID,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create GRN items table for detailed line items
CREATE TABLE IF NOT EXISTS public.grn_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  grn_id UUID NOT NULL REFERENCES public.goods_receipt_notes(id) ON DELETE CASCADE,
  item_code TEXT,
  item_name TEXT NOT NULL,
  description TEXT,
  warehouse_item_id UUID,
  po_item_id UUID,
  quantity_ordered NUMERIC(15,3) DEFAULT 0,
  quantity_received NUMERIC(15,3) NOT NULL,
  unit_of_measure TEXT NOT NULL DEFAULT 'pcs',
  unit_price NUMERIC(15,2),
  total_cost NUMERIC(15,2),
  quality_status TEXT DEFAULT 'good' CHECK (quality_status IN ('good', 'damaged', 'rejected')),
  remarks TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create function to generate GRN number
CREATE OR REPLACE FUNCTION public.generate_grn_number()
RETURNS TEXT AS $$
DECLARE
  next_number INTEGER;
  new_grn_number TEXT;
BEGIN
  -- Get the next sequence number for today
  SELECT COALESCE(MAX(CAST(SUBSTRING(grn_number FROM 'GRN-' || TO_CHAR(CURRENT_DATE, 'YYYYMMDD') || '-(.*)') AS INTEGER)), 0) + 1
  INTO next_number
  FROM goods_receipt_notes
  WHERE grn_number LIKE 'GRN-' || TO_CHAR(CURRENT_DATE, 'YYYYMMDD') || '-%';
  
  -- Generate GRN number: GRN-YYYYMMDD-001
  new_grn_number := 'GRN-' || TO_CHAR(CURRENT_DATE, 'YYYYMMDD') || '-' || LPAD(next_number::TEXT, 3, '0');
  
  RETURN new_grn_number;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Create trigger to update GRN total value
CREATE OR REPLACE FUNCTION public.update_grn_total_value()
RETURNS TRIGGER AS $$
DECLARE
  grn_total_value NUMERIC(15,2);
BEGIN
  -- Calculate total from all items for the specific GRN
  SELECT COALESCE(SUM(gi.total_cost), 0)
  INTO grn_total_value
  FROM grn_items gi
  WHERE gi.grn_id = COALESCE(NEW.grn_id, OLD.grn_id);
  
  -- Update the GRN total
  UPDATE goods_receipt_notes
  SET total_value = grn_total_value,
      updated_at = now()
  WHERE id = COALESCE(NEW.grn_id, OLD.grn_id);
  
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Create trigger for GRN total calculation
CREATE TRIGGER update_grn_total_trigger
  AFTER INSERT OR UPDATE OR DELETE ON public.grn_items
  FOR EACH ROW
  EXECUTE FUNCTION public.update_grn_total_value();

-- Create trigger to update stock when GRN is approved
CREATE OR REPLACE FUNCTION public.update_stock_on_grn_approval()
RETURNS TRIGGER AS $$
BEGIN
  -- Only update stock when status changes from non-approved to approved
  IF NEW.status = 'approved' AND (OLD.status IS NULL OR OLD.status != 'approved') THEN
    -- Insert stock transactions for all GRN items
    INSERT INTO public.stock_transactions (
      item_id,
      transaction_type,
      reference_type,
      reference_id,
      quantity_change,
      quantity_before,
      quantity_after,
      unit_cost,
      total_value,
      notes,
      company_id,
      created_by
    )
    SELECT 
      gi.warehouse_item_id,
      'goods_receipt'::stock_transaction_type,
      'grn'::stock_reference_type,
      NEW.id,
      gi.quantity_received,
      COALESCE(wi.current_stock, 0),
      COALESCE(wi.current_stock, 0) + gi.quantity_received,
      gi.unit_price,
      gi.total_cost,
      'GRN: ' || NEW.grn_number,
      NEW.company_id,
      NEW.approved_by
    FROM grn_items gi
    LEFT JOIN warehouse_items wi ON gi.warehouse_item_id = wi.id
    WHERE gi.grn_id = NEW.id AND gi.warehouse_item_id IS NOT NULL;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Create trigger for stock updates
CREATE TRIGGER grn_approval_stock_update_trigger
  AFTER UPDATE ON public.goods_receipt_notes
  FOR EACH ROW
  WHEN (NEW.status = 'approved' AND OLD.status != 'approved')
  EXECUTE FUNCTION public.update_stock_on_grn_approval();

-- Enable RLS
ALTER TABLE public.goods_receipt_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.grn_items ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for goods_receipt_notes
CREATE POLICY "Authenticated users can view GRNs" ON public.goods_receipt_notes
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can create GRNs" ON public.goods_receipt_notes
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL AND auth.uid() = created_by);

CREATE POLICY "Users can update their own draft GRNs or admins can update any" ON public.goods_receipt_notes
  FOR UPDATE USING ((auth.uid() = created_by AND status = 'draft') OR is_admin(auth.uid()));

CREATE POLICY "Admins can delete GRNs" ON public.goods_receipt_notes
  FOR DELETE USING (is_admin(auth.uid()));

-- Create RLS policies for grn_items
CREATE POLICY "Users can view GRN items they have access to" ON public.grn_items
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM goods_receipt_notes grn
      WHERE grn.id = grn_items.grn_id 
      AND (grn.created_by = auth.uid() OR is_admin(auth.uid()))
    )
  );

CREATE POLICY "Users can manage items for their own GRNs" ON public.grn_items
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM goods_receipt_notes grn
      WHERE grn.id = grn_items.grn_id 
      AND ((grn.created_by = auth.uid() AND grn.status = 'draft') OR is_admin(auth.uid()))
    )
  );

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_grn_number ON public.goods_receipt_notes(grn_number);
CREATE INDEX IF NOT EXISTS idx_grn_date ON public.goods_receipt_notes(grn_date);
CREATE INDEX IF NOT EXISTS idx_grn_status ON public.goods_receipt_notes(status);
CREATE INDEX IF NOT EXISTS idx_grn_supplier ON public.goods_receipt_notes(supplier_id);
CREATE INDEX IF NOT EXISTS idx_grn_po ON public.goods_receipt_notes(po_id);
CREATE INDEX IF NOT EXISTS idx_grn_items_grn_id ON public.grn_items(grn_id);
CREATE INDEX IF NOT EXISTS idx_grn_items_item_code ON public.grn_items(item_code);