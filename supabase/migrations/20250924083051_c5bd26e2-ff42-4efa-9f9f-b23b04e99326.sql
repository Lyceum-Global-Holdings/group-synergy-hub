-- Add finished goods inventory tables for Uniform Hub company

-- Create finished_goods table to track finished products
CREATE TABLE public.finished_goods (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_name TEXT NOT NULL,
  product_code TEXT NOT NULL,
  style_no TEXT,
  size TEXT,
  color TEXT,
  variant TEXT,
  description TEXT,
  category TEXT,
  unit_of_measure TEXT NOT NULL DEFAULT 'pcs',
  selling_price NUMERIC(15,2),
  standard_cost NUMERIC(15,2),
  current_stock NUMERIC(15,2) NOT NULL DEFAULT 0,
  reserved_stock NUMERIC(15,2) NOT NULL DEFAULT 0,
  available_stock NUMERIC(15,2) GENERATED ALWAYS AS (current_stock - reserved_stock) STORED,
  minimum_stock NUMERIC(15,2) DEFAULT 0,
  maximum_stock NUMERIC(15,2) DEFAULT 0,
  reorder_point NUMERIC(15,2) DEFAULT 0,
  lead_time_days INTEGER DEFAULT 0,
  quality_status TEXT DEFAULT 'approved' CHECK (quality_status IN ('approved', 'pending', 'rejected')),
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'discontinued')),
  location_id UUID,
  sublocation_id UUID,
  bin_id UUID,
  bom_id UUID, -- Link to bill of materials
  warehouse_item_id UUID, -- Link to existing warehouse items if needed
  company_id UUID,
  created_by UUID,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(product_code, company_id)
);

-- Create finished_goods_batches table for production batch tracking
CREATE TABLE public.finished_goods_batches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_number TEXT NOT NULL,
  finished_good_id UUID NOT NULL REFERENCES public.finished_goods(id) ON DELETE CASCADE,
  quantity NUMERIC(15,2) NOT NULL,
  production_date DATE NOT NULL,
  expiry_date DATE,
  production_cost NUMERIC(15,2),
  quality_check_status TEXT DEFAULT 'pending' CHECK (quality_check_status IN ('pending', 'passed', 'failed')),
  quality_check_date TIMESTAMP WITH TIME ZONE,
  quality_check_by UUID,
  notes TEXT,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'consumed', 'expired', 'rejected')),
  company_id UUID,
  created_by UUID,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(batch_number, company_id)
);

-- Create finished_goods_movements table for detailed movement tracking
CREATE TABLE public.finished_goods_movements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  finished_good_id UUID NOT NULL REFERENCES public.finished_goods(id) ON DELETE CASCADE,
  batch_id UUID REFERENCES public.finished_goods_batches(id),
  movement_type TEXT NOT NULL CHECK (movement_type IN ('production_receipt', 'sales_issue', 'transfer', 'adjustment', 'return')),
  reference_type TEXT CHECK (reference_type IN ('production_order', 'sales_order', 'transfer_order', 'adjustment', 'return_note')),
  reference_id UUID,
  reference_number TEXT,
  quantity_change NUMERIC(15,2) NOT NULL,
  quantity_before NUMERIC(15,2) NOT NULL DEFAULT 0,
  quantity_after NUMERIC(15,2) NOT NULL DEFAULT 0,
  unit_cost NUMERIC(15,2),
  total_value NUMERIC(15,2),
  from_location_id UUID,
  to_location_id UUID,
  notes TEXT,
  company_id UUID,
  created_by UUID,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create finished_goods_reservations table for sales order reservations
CREATE TABLE public.finished_goods_reservations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  finished_good_id UUID NOT NULL REFERENCES public.finished_goods(id) ON DELETE CASCADE,
  batch_id UUID REFERENCES public.finished_goods_batches(id),
  reserved_quantity NUMERIC(15,2) NOT NULL,
  reference_type TEXT NOT NULL CHECK (reference_type IN ('sales_order', 'transfer_order', 'production_order')),
  reference_id UUID NOT NULL,
  reference_number TEXT,
  reserved_date DATE NOT NULL DEFAULT CURRENT_DATE,
  required_date DATE,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'fulfilled', 'cancelled', 'expired')),
  notes TEXT,
  company_id UUID,
  created_by UUID,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Add RLS policies for finished_goods
ALTER TABLE public.finished_goods ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view finished goods" 
ON public.finished_goods FOR SELECT 
USING (auth.uid() IS NOT NULL);

CREATE POLICY "Users can create finished goods" 
ON public.finished_goods FOR INSERT 
WITH CHECK (auth.uid() IS NOT NULL AND auth.uid() = created_by);

CREATE POLICY "Users can update finished goods they created or admins can update any" 
ON public.finished_goods FOR UPDATE 
USING (auth.uid() = created_by OR is_admin(auth.uid()));

CREATE POLICY "Admins can delete finished goods" 
ON public.finished_goods FOR DELETE 
USING (is_admin(auth.uid()));

-- Add RLS policies for finished_goods_batches
ALTER TABLE public.finished_goods_batches ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view finished goods batches" 
ON public.finished_goods_batches FOR SELECT 
USING (auth.uid() IS NOT NULL);

CREATE POLICY "Users can create finished goods batches" 
ON public.finished_goods_batches FOR INSERT 
WITH CHECK (auth.uid() IS NOT NULL AND auth.uid() = created_by);

CREATE POLICY "Users can update batches they created or admins can update any" 
ON public.finished_goods_batches FOR UPDATE 
USING (auth.uid() = created_by OR is_admin(auth.uid()));

CREATE POLICY "Admins can delete finished goods batches" 
ON public.finished_goods_batches FOR DELETE 
USING (is_admin(auth.uid()));

-- Add RLS policies for finished_goods_movements
ALTER TABLE public.finished_goods_movements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view finished goods movements" 
ON public.finished_goods_movements FOR SELECT 
USING (auth.uid() IS NOT NULL);

CREATE POLICY "Users can create finished goods movements" 
ON public.finished_goods_movements FOR INSERT 
WITH CHECK (auth.uid() IS NOT NULL AND auth.uid() = created_by);

CREATE POLICY "Users can update movements they created or admins can update any" 
ON public.finished_goods_movements FOR UPDATE 
USING (auth.uid() = created_by OR is_admin(auth.uid()));

CREATE POLICY "Admins can delete finished goods movements" 
ON public.finished_goods_movements FOR DELETE 
USING (is_admin(auth.uid()));

-- Add RLS policies for finished_goods_reservations
ALTER TABLE public.finished_goods_reservations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view finished goods reservations" 
ON public.finished_goods_reservations FOR SELECT 
USING (auth.uid() IS NOT NULL);

CREATE POLICY "Users can create finished goods reservations" 
ON public.finished_goods_reservations FOR INSERT 
WITH CHECK (auth.uid() IS NOT NULL AND auth.uid() = created_by);

CREATE POLICY "Users can update reservations they created or admins can update any" 
ON public.finished_goods_reservations FOR UPDATE 
USING (auth.uid() = created_by OR is_admin(auth.uid()));

CREATE POLICY "Admins can delete finished goods reservations" 
ON public.finished_goods_reservations FOR DELETE 
USING (is_admin(auth.uid()));

-- Create triggers for automatic timestamp updates
CREATE TRIGGER update_finished_goods_updated_at
  BEFORE UPDATE ON public.finished_goods
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_finished_goods_batches_updated_at
  BEFORE UPDATE ON public.finished_goods_batches
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_finished_goods_movements_updated_at
  BEFORE UPDATE ON public.finished_goods_movements
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_finished_goods_reservations_updated_at
  BEFORE UPDATE ON public.finished_goods_reservations
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Create function to update finished goods stock
CREATE OR REPLACE FUNCTION public.update_finished_goods_stock()
RETURNS TRIGGER AS $$
BEGIN
  -- Update the current_stock in finished_goods
  UPDATE public.finished_goods
  SET current_stock = NEW.quantity_after,
      updated_at = now()
  WHERE id = NEW.finished_good_id;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Create trigger to automatically update finished goods stock
CREATE TRIGGER update_finished_goods_stock_trigger
  AFTER INSERT ON public.finished_goods_movements
  FOR EACH ROW
  EXECUTE FUNCTION public.update_finished_goods_stock();