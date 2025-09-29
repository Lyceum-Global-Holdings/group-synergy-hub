-- Create sales orders table for pick/pack/dispatch workflow
CREATE TABLE public.sales_orders (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  order_number TEXT NOT NULL UNIQUE,
  cpo_id UUID NOT NULL REFERENCES customer_purchase_orders(id),
  customer_id UUID NOT NULL REFERENCES customers(id),
  order_date DATE NOT NULL DEFAULT CURRENT_DATE,
  required_date DATE,
  priority TEXT NOT NULL DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
  status TEXT NOT NULL DEFAULT 'confirmed' CHECK (status IN ('confirmed', 'picking', 'picked', 'packing', 'packed', 'dispatched', 'delivered', 'cancelled')),
  delivery_address TEXT,
  special_instructions TEXT,
  total_items INTEGER NOT NULL DEFAULT 0,
  picked_items INTEGER NOT NULL DEFAULT 0,
  packed_items INTEGER NOT NULL DEFAULT 0,
  company_id UUID,
  created_by UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create pick lists table
CREATE TABLE public.pick_lists (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  pick_list_number TEXT NOT NULL UNIQUE,
  sales_order_id UUID NOT NULL REFERENCES sales_orders(id) ON DELETE CASCADE,
  picker_id UUID REFERENCES auth.users(id),
  pick_zone TEXT,
  priority TEXT NOT NULL DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'assigned', 'in_progress', 'completed', 'cancelled')),
  total_items INTEGER NOT NULL DEFAULT 0,
  picked_items INTEGER NOT NULL DEFAULT 0,
  started_at TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE,
  estimated_pick_time INTEGER, -- minutes
  actual_pick_time INTEGER, -- minutes
  notes TEXT,
  company_id UUID,
  created_by UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create pick list items table
CREATE TABLE public.pick_list_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  pick_list_id UUID NOT NULL REFERENCES pick_lists(id) ON DELETE CASCADE,
  finished_good_id UUID NOT NULL REFERENCES finished_goods(id),
  location_id UUID REFERENCES warehouse_locations(id),
  bin_id UUID REFERENCES warehouse_bins(id),
  quantity_to_pick NUMERIC(15,2) NOT NULL,
  quantity_picked NUMERIC(15,2) NOT NULL DEFAULT 0,
  pick_sequence INTEGER NOT NULL DEFAULT 1,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'picked', 'short_pick', 'not_found')),
  picked_at TIMESTAMP WITH TIME ZONE,
  picked_by UUID REFERENCES auth.users(id),
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create packing lists table (for Phase 2, but creating schema now)
CREATE TABLE public.packing_lists (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  packing_list_number TEXT NOT NULL UNIQUE,
  sales_order_id UUID NOT NULL REFERENCES sales_orders(id) ON DELETE CASCADE,
  pick_list_id UUID NOT NULL REFERENCES pick_lists(id),
  packer_id UUID REFERENCES auth.users(id),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed', 'quality_check')),
  package_type TEXT,
  package_weight NUMERIC(10,2),
  package_dimensions TEXT, -- JSON string with length, width, height
  quality_checked_by UUID REFERENCES auth.users(id),
  quality_checked_at TIMESTAMP WITH TIME ZONE,
  notes TEXT,
  company_id UUID,
  created_by UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create dispatch records table (for Phase 2, but creating schema now)
CREATE TABLE public.dispatch_records (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  dispatch_number TEXT NOT NULL UNIQUE,
  sales_order_id UUID NOT NULL REFERENCES sales_orders(id) ON DELETE CASCADE,
  packing_list_id UUID NOT NULL REFERENCES packing_lists(id),
  courier_name TEXT,
  tracking_number TEXT,
  dispatch_date DATE NOT NULL DEFAULT CURRENT_DATE,
  estimated_delivery_date DATE,
  actual_delivery_date DATE,
  delivery_address TEXT NOT NULL,
  delivery_contact TEXT,
  delivery_phone TEXT,
  status TEXT NOT NULL DEFAULT 'ready_to_dispatch' CHECK (status IN ('ready_to_dispatch', 'dispatched', 'in_transit', 'out_for_delivery', 'delivered', 'failed_delivery', 'returned')),
  proof_of_delivery_url TEXT,
  delivery_notes TEXT,
  company_id UUID,
  created_by UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on all tables
ALTER TABLE public.sales_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pick_lists ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pick_list_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.packing_lists ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dispatch_records ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for sales_orders
CREATE POLICY "Authenticated users can view sales orders" 
ON public.sales_orders FOR SELECT 
USING (auth.uid() IS NOT NULL);

CREATE POLICY "Users can create sales orders" 
ON public.sales_orders FOR INSERT 
WITH CHECK ((auth.uid() IS NOT NULL) AND (auth.uid() = created_by));

CREATE POLICY "Users can update sales orders they created or admins can update any" 
ON public.sales_orders FOR UPDATE 
USING ((auth.uid() = created_by) OR is_admin(auth.uid()));

CREATE POLICY "Admins can delete sales orders" 
ON public.sales_orders FOR DELETE 
USING (is_admin(auth.uid()));

-- Create RLS policies for pick_lists
CREATE POLICY "Authenticated users can view pick lists" 
ON public.pick_lists FOR SELECT 
USING (auth.uid() IS NOT NULL);

CREATE POLICY "Users can create pick lists" 
ON public.pick_lists FOR INSERT 
WITH CHECK ((auth.uid() IS NOT NULL) AND (auth.uid() = created_by));

CREATE POLICY "Users can update pick lists they created, assigned pickers, or admins" 
ON public.pick_lists FOR UPDATE 
USING ((auth.uid() = created_by) OR (auth.uid() = picker_id) OR is_admin(auth.uid()));

CREATE POLICY "Admins can delete pick lists" 
ON public.pick_lists FOR DELETE 
USING (is_admin(auth.uid()));

-- Create RLS policies for pick_list_items
CREATE POLICY "Users can view pick list items they have access to" 
ON public.pick_list_items FOR SELECT 
USING (EXISTS (
  SELECT 1 FROM pick_lists pl 
  WHERE pl.id = pick_list_items.pick_list_id 
  AND ((pl.created_by = auth.uid()) OR (pl.picker_id = auth.uid()) OR is_admin(auth.uid()))
));

CREATE POLICY "Users can manage pick list items for their pick lists" 
ON public.pick_list_items FOR ALL 
USING (EXISTS (
  SELECT 1 FROM pick_lists pl 
  WHERE pl.id = pick_list_items.pick_list_id 
  AND ((pl.created_by = auth.uid()) OR (pl.picker_id = auth.uid()) OR is_admin(auth.uid()))
));

-- Create RLS policies for packing_lists
CREATE POLICY "Authenticated users can view packing lists" 
ON public.packing_lists FOR SELECT 
USING (auth.uid() IS NOT NULL);

CREATE POLICY "Users can create packing lists" 
ON public.packing_lists FOR INSERT 
WITH CHECK ((auth.uid() IS NOT NULL) AND (auth.uid() = created_by));

CREATE POLICY "Users can update packing lists they created, assigned packers, or admins" 
ON public.packing_lists FOR UPDATE 
USING ((auth.uid() = created_by) OR (auth.uid() = packer_id) OR is_admin(auth.uid()));

CREATE POLICY "Admins can delete packing lists" 
ON public.packing_lists FOR DELETE 
USING (is_admin(auth.uid()));

-- Create RLS policies for dispatch_records
CREATE POLICY "Authenticated users can view dispatch records" 
ON public.dispatch_records FOR SELECT 
USING (auth.uid() IS NOT NULL);

CREATE POLICY "Users can create dispatch records" 
ON public.dispatch_records FOR INSERT 
WITH CHECK ((auth.uid() IS NOT NULL) AND (auth.uid() = created_by));

CREATE POLICY "Users can update dispatch records they created or admins can update any" 
ON public.dispatch_records FOR UPDATE 
USING ((auth.uid() = created_by) OR is_admin(auth.uid()));

CREATE POLICY "Admins can delete dispatch records" 
ON public.dispatch_records FOR DELETE 
USING (is_admin(auth.uid()));

-- Create indexes for performance
CREATE INDEX idx_sales_orders_cpo_id ON public.sales_orders(cpo_id);
CREATE INDEX idx_sales_orders_customer_id ON public.sales_orders(customer_id);
CREATE INDEX idx_sales_orders_status ON public.sales_orders(status);
CREATE INDEX idx_sales_orders_required_date ON public.sales_orders(required_date);

CREATE INDEX idx_pick_lists_sales_order_id ON public.pick_lists(sales_order_id);
CREATE INDEX idx_pick_lists_picker_id ON public.pick_lists(picker_id);
CREATE INDEX idx_pick_lists_status ON public.pick_lists(status);

CREATE INDEX idx_pick_list_items_pick_list_id ON public.pick_list_items(pick_list_id);
CREATE INDEX idx_pick_list_items_finished_good_id ON public.pick_list_items(finished_good_id);
CREATE INDEX idx_pick_list_items_status ON public.pick_list_items(status);

-- Create auto-generation functions for order numbers
CREATE OR REPLACE FUNCTION public.generate_sales_order_number()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  next_number INTEGER;
  new_order_number TEXT;
BEGIN
  -- Get the next sequence number for today
  SELECT COALESCE(MAX(CAST(SUBSTRING(order_number FROM 'SO-' || TO_CHAR(CURRENT_DATE, 'YYYYMMDD') || '-(.*)') AS INTEGER)), 0) + 1
  INTO next_number
  FROM sales_orders
  WHERE order_number LIKE 'SO-' || TO_CHAR(CURRENT_DATE, 'YYYYMMDD') || '-%';
  
  -- Generate sales order number: SO-YYYYMMDD-001
  new_order_number := 'SO-' || TO_CHAR(CURRENT_DATE, 'YYYYMMDD') || '-' || LPAD(next_number::TEXT, 3, '0');
  
  RETURN new_order_number;
END;
$$;

CREATE OR REPLACE FUNCTION public.generate_pick_list_number()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  next_number INTEGER;
  new_pick_number TEXT;
BEGIN
  -- Get the next sequence number for today
  SELECT COALESCE(MAX(CAST(SUBSTRING(pick_list_number FROM 'PL-' || TO_CHAR(CURRENT_DATE, 'YYYYMMDD') || '-(.*)') AS INTEGER)), 0) + 1
  INTO next_number
  FROM pick_lists
  WHERE pick_list_number LIKE 'PL-' || TO_CHAR(CURRENT_DATE, 'YYYYMMDD') || '-%';
  
  -- Generate pick list number: PL-YYYYMMDD-001
  new_pick_number := 'PL-' || TO_CHAR(CURRENT_DATE, 'YYYYMMDD') || '-' || LPAD(next_number::TEXT, 3, '0');
  
  RETURN new_pick_number;
END;
$$;

-- Create triggers for auto-generation
CREATE OR REPLACE FUNCTION public.auto_generate_sales_order_number()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.order_number IS NULL OR NEW.order_number = '' THEN
    NEW.order_number := generate_sales_order_number();
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.auto_generate_pick_list_number()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.pick_list_number IS NULL OR NEW.pick_list_number = '' THEN
    NEW.pick_list_number := generate_pick_list_number();
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trigger_auto_generate_sales_order_number
BEFORE INSERT ON public.sales_orders
FOR EACH ROW EXECUTE FUNCTION public.auto_generate_sales_order_number();

CREATE TRIGGER trigger_auto_generate_pick_list_number
BEFORE INSERT ON public.pick_lists
FOR EACH ROW EXECUTE FUNCTION public.auto_generate_pick_list_number();

-- Create triggers for updating timestamps
CREATE TRIGGER update_sales_orders_updated_at
BEFORE UPDATE ON public.sales_orders
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_pick_lists_updated_at
BEFORE UPDATE ON public.pick_lists
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_pick_list_items_updated_at
BEFORE UPDATE ON public.pick_list_items
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_packing_lists_updated_at
BEFORE UPDATE ON public.packing_lists
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_dispatch_records_updated_at
BEFORE UPDATE ON public.dispatch_records
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();