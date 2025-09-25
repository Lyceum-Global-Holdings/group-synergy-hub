-- Create customers table
CREATE TABLE public.customers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  customer_code TEXT NOT NULL UNIQUE,
  customer_name TEXT NOT NULL,
  contact_person TEXT,
  email TEXT,
  phone TEXT,
  address TEXT,
  company_id UUID REFERENCES public.companies(id),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  created_by UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create customer_purchase_orders table
CREATE TABLE public.customer_purchase_orders (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  cpo_number TEXT NOT NULL UNIQUE,
  customer_id UUID NOT NULL REFERENCES public.customers(id),
  company_id UUID REFERENCES public.companies(id),
  po_date DATE NOT NULL DEFAULT CURRENT_DATE,
  delivery_date DATE,
  total_amount NUMERIC(15,2) DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'confirmed', 'in_production', 'delivered', 'completed', 'cancelled')),
  notes TEXT,
  created_by UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create customer_po_items table
CREATE TABLE public.customer_po_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  cpo_id UUID NOT NULL REFERENCES public.customer_purchase_orders(id) ON DELETE CASCADE,
  finished_good_id UUID REFERENCES public.finished_goods(id),
  item_name TEXT NOT NULL,
  description TEXT,
  quantity_ordered NUMERIC NOT NULL DEFAULT 0,
  unit_price NUMERIC(15,2) DEFAULT 0,
  total_price NUMERIC(15,2) DEFAULT 0,
  delivery_date DATE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'in_production', 'delivered')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customer_purchase_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customer_po_items ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for customers
CREATE POLICY "Authenticated users can view customers" ON public.customers
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "Users can create customers" ON public.customers
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL AND auth.uid() = created_by);

CREATE POLICY "Users can update customers they created or admins can update any" ON public.customers
  FOR UPDATE USING (auth.uid() = created_by OR is_admin(auth.uid()));

CREATE POLICY "Admins can delete customers" ON public.customers
  FOR DELETE USING (is_admin(auth.uid()));

-- Create RLS policies for customer_purchase_orders
CREATE POLICY "Authenticated users can view customer POs" ON public.customer_purchase_orders
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "Users can create customer POs" ON public.customer_purchase_orders
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL AND auth.uid() = created_by);

CREATE POLICY "Users can update customer POs they created or admins can update any" ON public.customer_purchase_orders
  FOR UPDATE USING (auth.uid() = created_by OR is_admin(auth.uid()));

CREATE POLICY "Admins can delete customer POs" ON public.customer_purchase_orders
  FOR DELETE USING (is_admin(auth.uid()));

-- Create RLS policies for customer_po_items
CREATE POLICY "Users can view customer PO items they have access to" ON public.customer_po_items
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.customer_purchase_orders cpo
      WHERE cpo.id = customer_po_items.cpo_id
      AND (cpo.created_by = auth.uid() OR is_admin(auth.uid()))
    )
  );

CREATE POLICY "Users can manage customer PO items for their own CPOs" ON public.customer_po_items
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.customer_purchase_orders cpo
      WHERE cpo.id = customer_po_items.cpo_id
      AND (cpo.created_by = auth.uid() OR is_admin(auth.uid()))
    )
  );

-- Create function to generate customer code
CREATE OR REPLACE FUNCTION public.generate_customer_code()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  next_number INTEGER;
  new_customer_code TEXT;
BEGIN
  -- Get the next sequence number
  SELECT COALESCE(MAX(CAST(SUBSTRING(customers.customer_code FROM 'CUST-(.*)') AS INTEGER)), 0) + 1
  INTO next_number
  FROM customers
  WHERE customers.customer_code LIKE 'CUST-%';
  
  -- Generate customer code: CUST-0001
  new_customer_code := 'CUST-' || LPAD(next_number::TEXT, 4, '0');
  
  RETURN new_customer_code;
END;
$$;

-- Create function to generate customer PO number
CREATE OR REPLACE FUNCTION public.generate_cpo_number()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  next_number INTEGER;
  new_cpo_number TEXT;
BEGIN
  -- Get the next sequence number for today
  SELECT COALESCE(MAX(CAST(SUBSTRING(customer_purchase_orders.cpo_number FROM 'CPO-' || TO_CHAR(CURRENT_DATE, 'YYYYMMDD') || '-(.*)') AS INTEGER)), 0) + 1
  INTO next_number
  FROM customer_purchase_orders
  WHERE customer_purchase_orders.cpo_number LIKE 'CPO-' || TO_CHAR(CURRENT_DATE, 'YYYYMMDD') || '-%';
  
  -- Generate CPO number: CPO-YYYYMMDD-001
  new_cpo_number := 'CPO-' || TO_CHAR(CURRENT_DATE, 'YYYYMMDD') || '-' || LPAD(next_number::TEXT, 3, '0');
  
  RETURN new_cpo_number;
END;
$$;

-- Create trigger to auto-generate customer code
CREATE OR REPLACE FUNCTION public.auto_generate_customer_code()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  -- Only generate if customer_code is not already set
  IF NEW.customer_code IS NULL OR NEW.customer_code = '' THEN
    NEW.customer_code := generate_customer_code();
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trigger_auto_generate_customer_code
  BEFORE INSERT ON public.customers
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_generate_customer_code();

-- Create trigger to auto-generate CPO number
CREATE OR REPLACE FUNCTION public.auto_generate_cpo_number()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  -- Only generate if cpo_number is not already set
  IF NEW.cpo_number IS NULL OR NEW.cpo_number = '' THEN
    NEW.cpo_number := generate_cpo_number();
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trigger_auto_generate_cpo_number
  BEFORE INSERT ON public.customer_purchase_orders
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_generate_cpo_number();

-- Create function to update customer PO total amount
CREATE OR REPLACE FUNCTION public.update_cpo_total_amount()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = 'public'
AS $$
DECLARE
  cpo_total_amount NUMERIC(15,2);
BEGIN
  -- Calculate total from all items for the specific CPO
  SELECT COALESCE(SUM(cpi.total_price), 0)
  INTO cpo_total_amount
  FROM customer_po_items cpi
  WHERE cpi.cpo_id = COALESCE(NEW.cpo_id, OLD.cpo_id);
  
  -- Update the CPO total
  UPDATE customer_purchase_orders
  SET total_amount = cpo_total_amount,
      updated_at = now()
  WHERE id = COALESCE(NEW.cpo_id, OLD.cpo_id);
  
  RETURN COALESCE(NEW, OLD);
END;
$$;

-- Create trigger to update CPO total when items change
CREATE TRIGGER trigger_update_cpo_total_amount
  AFTER INSERT OR UPDATE OR DELETE ON public.customer_po_items
  FOR EACH ROW
  EXECUTE FUNCTION public.update_cpo_total_amount();

-- Create trigger to update updated_at timestamp
CREATE TRIGGER trigger_update_customers_updated_at
  BEFORE UPDATE ON public.customers
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER trigger_update_customer_purchase_orders_updated_at
  BEFORE UPDATE ON public.customer_purchase_orders
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER trigger_update_customer_po_items_updated_at
  BEFORE UPDATE ON public.customer_po_items
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();