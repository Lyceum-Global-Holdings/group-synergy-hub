-- Create purchase orders table
CREATE TABLE public.purchase_orders (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  po_number TEXT NOT NULL UNIQUE,
  pr_id UUID REFERENCES public.purchase_requisitions(id),
  supplier_id UUID NOT NULL REFERENCES public.suppliers(id),
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'sent', 'acknowledged', 'partially_received', 'completed', 'cancelled')),
  po_date DATE NOT NULL DEFAULT CURRENT_DATE,
  expected_delivery_date DATE,
  actual_delivery_date DATE,
  total_amount NUMERIC(15,2) DEFAULT 0,
  tax_amount NUMERIC(15,2) DEFAULT 0,
  discount_amount NUMERIC(15,2) DEFAULT 0,
  final_amount NUMERIC(15,2) DEFAULT 0,
  payment_terms TEXT,
  delivery_terms TEXT,
  currency TEXT DEFAULT 'USD',
  buyer_id UUID REFERENCES auth.users(id),
  created_by UUID NOT NULL REFERENCES auth.users(id),
  approved_by UUID REFERENCES auth.users(id),
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create po_items table
CREATE TABLE public.po_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  po_id UUID NOT NULL REFERENCES public.purchase_orders(id) ON DELETE CASCADE,
  pr_item_id UUID REFERENCES public.pr_items(id),
  item_name TEXT NOT NULL,
  description TEXT,
  specifications TEXT,
  quantity_ordered NUMERIC NOT NULL,
  quantity_received NUMERIC DEFAULT 0,
  quantity_pending NUMERIC DEFAULT 0,
  unit_price NUMERIC(15,2) NOT NULL,
  total_price NUMERIC(15,2) NOT NULL,
  unit_of_measure TEXT NOT NULL DEFAULT 'pcs',
  delivery_date DATE,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create po_receipts table
CREATE TABLE public.po_receipts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  po_id UUID NOT NULL REFERENCES public.purchase_orders(id) ON DELETE CASCADE,
  receipt_number TEXT NOT NULL,
  received_date DATE NOT NULL DEFAULT CURRENT_DATE,
  received_by UUID NOT NULL REFERENCES auth.users(id),
  status TEXT NOT NULL DEFAULT 'partial' CHECK (status IN ('partial', 'complete')),
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create po_receipt_items table
CREATE TABLE public.po_receipt_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  receipt_id UUID NOT NULL REFERENCES public.po_receipts(id) ON DELETE CASCADE,
  po_item_id UUID NOT NULL REFERENCES public.po_items(id),
  quantity_received NUMERIC NOT NULL,
  quality_status TEXT DEFAULT 'good' CHECK (quality_status IN ('good', 'damaged', 'rejected')),
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on all tables
ALTER TABLE public.purchase_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.po_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.po_receipts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.po_receipt_items ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for purchase_orders
CREATE POLICY "Users can view POs they created or if admin" 
ON public.purchase_orders 
FOR SELECT 
USING (auth.uid() = created_by OR auth.uid() = buyer_id OR is_admin(auth.uid()));

CREATE POLICY "Users can create POs" 
ON public.purchase_orders 
FOR INSERT 
WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Users can update their own POs or admins can update any" 
ON public.purchase_orders 
FOR UPDATE 
USING (auth.uid() = created_by OR auth.uid() = buyer_id OR is_admin(auth.uid()));

CREATE POLICY "Admins can delete POs" 
ON public.purchase_orders 
FOR DELETE 
USING (is_admin(auth.uid()));

-- Create RLS policies for po_items
CREATE POLICY "Users can view PO items they have access to" 
ON public.po_items 
FOR SELECT 
USING (EXISTS (
  SELECT 1 FROM public.purchase_orders po 
  WHERE po.id = po_items.po_id 
  AND (po.created_by = auth.uid() OR po.buyer_id = auth.uid() OR is_admin(auth.uid()))
));

CREATE POLICY "Users can manage PO items of their own POs" 
ON public.po_items 
FOR ALL 
USING (EXISTS (
  SELECT 1 FROM public.purchase_orders po 
  WHERE po.id = po_items.po_id 
  AND (po.created_by = auth.uid() OR po.buyer_id = auth.uid() OR is_admin(auth.uid()))
));

-- Create RLS policies for po_receipts
CREATE POLICY "Users can view receipts for POs they have access to" 
ON public.po_receipts 
FOR SELECT 
USING (EXISTS (
  SELECT 1 FROM public.purchase_orders po 
  WHERE po.id = po_receipts.po_id 
  AND (po.created_by = auth.uid() OR po.buyer_id = auth.uid() OR is_admin(auth.uid()))
));

CREATE POLICY "Users can manage receipts for their POs" 
ON public.po_receipts 
FOR ALL 
USING (EXISTS (
  SELECT 1 FROM public.purchase_orders po 
  WHERE po.id = po_receipts.po_id 
  AND (po.created_by = auth.uid() OR po.buyer_id = auth.uid() OR is_admin(auth.uid()))
));

-- Create RLS policies for po_receipt_items
CREATE POLICY "Users can view receipt items for POs they have access to" 
ON public.po_receipt_items 
FOR SELECT 
USING (EXISTS (
  SELECT 1 FROM public.po_receipts pr 
  JOIN public.purchase_orders po ON po.id = pr.po_id
  WHERE pr.id = po_receipt_items.receipt_id 
  AND (po.created_by = auth.uid() OR po.buyer_id = auth.uid() OR is_admin(auth.uid()))
));

CREATE POLICY "Users can manage receipt items for their POs" 
ON public.po_receipt_items 
FOR ALL 
USING (EXISTS (
  SELECT 1 FROM public.po_receipts pr 
  JOIN public.purchase_orders po ON po.id = pr.po_id
  WHERE pr.id = po_receipt_items.receipt_id 
  AND (po.created_by = auth.uid() OR po.buyer_id = auth.uid() OR is_admin(auth.uid()))
));

-- Create function to generate PO number
CREATE OR REPLACE FUNCTION public.generate_po_number()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  next_number INTEGER;
  po_number TEXT;
BEGIN
  -- Get the next sequence number for today
  SELECT COALESCE(MAX(CAST(SUBSTRING(po_number FROM 'PO-' || TO_CHAR(CURRENT_DATE, 'YYYYMMDD') || '-(.*)') AS INTEGER)), 0) + 1
  INTO next_number
  FROM purchase_orders
  WHERE po_number LIKE 'PO-' || TO_CHAR(CURRENT_DATE, 'YYYYMMDD') || '-%';
  
  -- Generate PO number: PO-YYYYMMDD-001
  po_number := 'PO-' || TO_CHAR(CURRENT_DATE, 'YYYYMMDD') || '-' || LPAD(next_number::TEXT, 3, '0');
  
  RETURN po_number;
END;
$$;

-- Create function to update PO total amount
CREATE OR REPLACE FUNCTION public.update_po_total_amount()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  total_amount DECIMAL(15,2);
  final_amount DECIMAL(15,2);
BEGIN
  -- Calculate total from all items
  SELECT COALESCE(SUM(total_price), 0)
  INTO total_amount
  FROM po_items
  WHERE po_id = COALESCE(NEW.po_id, OLD.po_id);
  
  -- Calculate final amount (total + tax - discount)
  SELECT total_amount + COALESCE(tax_amount, 0) - COALESCE(discount_amount, 0)
  INTO final_amount
  FROM purchase_orders
  WHERE id = COALESCE(NEW.po_id, OLD.po_id);
  
  -- Update the PO totals
  UPDATE purchase_orders
  SET total_amount = total_amount,
      final_amount = final_amount,
      updated_at = now()
  WHERE id = COALESCE(NEW.po_id, OLD.po_id);
  
  RETURN COALESCE(NEW, OLD);
END;
$$;

-- Create function to update quantity pending
CREATE OR REPLACE FUNCTION public.update_po_item_quantities()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  -- Update quantity_pending when quantity_received changes
  IF TG_OP = 'INSERT' OR TG_OP = 'UPDATE' THEN
    NEW.quantity_pending := NEW.quantity_ordered - NEW.quantity_received;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create triggers
CREATE TRIGGER update_po_total_amount_trigger
AFTER INSERT OR UPDATE OR DELETE ON public.po_items
FOR EACH ROW EXECUTE FUNCTION public.update_po_total_amount();

CREATE TRIGGER update_po_item_quantities_trigger
BEFORE INSERT OR UPDATE ON public.po_items
FOR EACH ROW EXECUTE FUNCTION public.update_po_item_quantities();

CREATE TRIGGER update_purchase_orders_updated_at
BEFORE UPDATE ON public.purchase_orders
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_po_items_updated_at
BEFORE UPDATE ON public.po_items
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_po_receipts_updated_at
BEFORE UPDATE ON public.po_receipts
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_po_receipt_items_updated_at
BEFORE UPDATE ON public.po_receipt_items
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();