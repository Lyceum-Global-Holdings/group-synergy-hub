-- Create enum for contract types
CREATE TYPE blanket_contract_type AS ENUM ('blanket_po', 'contract_po', 'framework_agreement');

-- Create enum for contract status
CREATE TYPE blanket_contract_status AS ENUM ('draft', 'active', 'suspended', 'expired', 'closed', 'cancelled');

-- Create enum for release status
CREATE TYPE bpo_release_status AS ENUM ('draft', 'submitted', 'approved', 'sent', 'received', 'completed', 'cancelled');

-- Create enum for urgency level
CREATE TYPE urgency_level AS ENUM ('normal', 'urgent', 'emergency');

-- Create enum for amendment type
CREATE TYPE amendment_type AS ENUM ('price_change', 'quantity_change', 'term_extension', 'item_addition', 'item_removal', 'other');

-- Create blanket_purchase_orders table
CREATE TABLE public.blanket_purchase_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bpo_number TEXT UNIQUE NOT NULL,
  contract_type blanket_contract_type NOT NULL DEFAULT 'blanket_po',
  supplier_id UUID NOT NULL REFERENCES public.suppliers(id) ON DELETE RESTRICT,
  contract_start_date DATE NOT NULL,
  contract_end_date DATE NOT NULL,
  total_contract_value NUMERIC(15,2) NOT NULL DEFAULT 0,
  remaining_value NUMERIC(15,2) NOT NULL DEFAULT 0,
  contract_status blanket_contract_status NOT NULL DEFAULT 'draft',
  auto_renew BOOLEAN DEFAULT false,
  renewal_terms TEXT,
  payment_terms TEXT,
  delivery_terms TEXT,
  currency TEXT DEFAULT 'LKR',
  contract_terms TEXT,
  early_termination_terms TEXT,
  penalty_clauses JSONB,
  approval_workflow_required BOOLEAN DEFAULT true,
  created_by UUID REFERENCES auth.users(id),
  approved_by UUID REFERENCES auth.users(id),
  approved_date TIMESTAMP WITH TIME ZONE,
  company_id UUID REFERENCES public.companies(id),
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  CONSTRAINT valid_contract_dates CHECK (contract_end_date > contract_start_date),
  CONSTRAINT valid_contract_value CHECK (total_contract_value >= 0),
  CONSTRAINT valid_remaining_value CHECK (remaining_value >= 0)
);

-- Create blanket_po_items table
CREATE TABLE public.blanket_po_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bpo_id UUID NOT NULL REFERENCES public.blanket_purchase_orders(id) ON DELETE CASCADE,
  warehouse_item_id UUID REFERENCES public.warehouse_items(id),
  item_name TEXT NOT NULL,
  item_code TEXT,
  description TEXT,
  specifications TEXT,
  category TEXT,
  unit_price NUMERIC(15,2) NOT NULL,
  min_order_quantity NUMERIC(15,3),
  max_order_quantity NUMERIC(15,3),
  total_quantity_limit NUMERIC(15,3),
  quantity_released NUMERIC(15,3) DEFAULT 0,
  remaining_quantity NUMERIC(15,3),
  unit_of_measure TEXT NOT NULL DEFAULT 'pcs',
  lead_time_days INTEGER DEFAULT 0,
  price_validity_start DATE,
  price_validity_end DATE,
  discount_percentage NUMERIC(5,2) DEFAULT 0,
  discount_terms TEXT,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  CONSTRAINT valid_quantities CHECK (
    (max_order_quantity IS NULL OR min_order_quantity IS NULL OR max_order_quantity >= min_order_quantity) AND
    (total_quantity_limit IS NULL OR total_quantity_limit >= 0) AND
    quantity_released >= 0
  )
);

-- Create blanket_po_releases table
CREATE TABLE public.blanket_po_releases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  release_number TEXT UNIQUE NOT NULL,
  bpo_id UUID NOT NULL REFERENCES public.blanket_purchase_orders(id) ON DELETE RESTRICT,
  release_date DATE NOT NULL DEFAULT CURRENT_DATE,
  requested_by UUID REFERENCES auth.users(id),
  release_status bpo_release_status NOT NULL DEFAULT 'draft',
  delivery_location TEXT,
  expected_delivery_date DATE,
  actual_delivery_date DATE,
  total_amount NUMERIC(15,2) DEFAULT 0,
  approved_by UUID REFERENCES auth.users(id),
  approved_date TIMESTAMP WITH TIME ZONE,
  urgency_level urgency_level DEFAULT 'normal',
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

-- Create blanket_po_release_items table
CREATE TABLE public.blanket_po_release_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  release_id UUID NOT NULL REFERENCES public.blanket_po_releases(id) ON DELETE CASCADE,
  bpo_item_id UUID NOT NULL REFERENCES public.blanket_po_items(id) ON DELETE RESTRICT,
  quantity_requested NUMERIC(15,3) NOT NULL,
  quantity_approved NUMERIC(15,3),
  quantity_received NUMERIC(15,3) DEFAULT 0,
  unit_price NUMERIC(15,2) NOT NULL,
  total_price NUMERIC(15,2) NOT NULL,
  delivery_date DATE,
  delivery_location_id UUID REFERENCES public.warehouse_locations(id),
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  CONSTRAINT valid_release_quantities CHECK (
    quantity_requested > 0 AND
    (quantity_approved IS NULL OR quantity_approved >= 0) AND
    quantity_received >= 0
  )
);

-- Create blanket_po_amendments table
CREATE TABLE public.blanket_po_amendments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bpo_id UUID NOT NULL REFERENCES public.blanket_purchase_orders(id) ON DELETE CASCADE,
  amendment_number TEXT NOT NULL,
  amendment_date DATE NOT NULL DEFAULT CURRENT_DATE,
  amendment_type amendment_type NOT NULL,
  previous_value JSONB,
  new_value JSONB,
  reason TEXT NOT NULL,
  approved_by UUID REFERENCES auth.users(id),
  approved_date TIMESTAMP WITH TIME ZONE,
  created_by UUID REFERENCES auth.users(id),
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

-- Create blanket_po_spending_analytics table
CREATE TABLE public.blanket_po_spending_analytics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bpo_id UUID NOT NULL REFERENCES public.blanket_purchase_orders(id) ON DELETE CASCADE,
  analysis_period TEXT NOT NULL,
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  total_releases INTEGER DEFAULT 0,
  total_spent NUMERIC(15,2) DEFAULT 0,
  total_quantity NUMERIC(15,3) DEFAULT 0,
  average_lead_time NUMERIC(10,2),
  utilization_percentage NUMERIC(5,2),
  savings_achieved NUMERIC(15,2),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

-- Function to generate BPO number
CREATE OR REPLACE FUNCTION public.generate_bpo_number()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  next_number INTEGER;
  new_bpo_number TEXT;
BEGIN
  SELECT COALESCE(MAX(CAST(SUBSTRING(bpo_number FROM 'BPO-' || TO_CHAR(CURRENT_DATE, 'YYYYMMDD') || '-(.*)') AS INTEGER)), 0) + 1
  INTO next_number
  FROM blanket_purchase_orders
  WHERE bpo_number LIKE 'BPO-' || TO_CHAR(CURRENT_DATE, 'YYYYMMDD') || '-%';
  
  new_bpo_number := 'BPO-' || TO_CHAR(CURRENT_DATE, 'YYYYMMDD') || '-' || LPAD(next_number::TEXT, 3, '0');
  RETURN new_bpo_number;
END;
$$;

-- Function to generate release number
CREATE OR REPLACE FUNCTION public.generate_release_number()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  next_number INTEGER;
  new_release_number TEXT;
BEGIN
  SELECT COALESCE(MAX(CAST(SUBSTRING(release_number FROM 'REL-' || TO_CHAR(CURRENT_DATE, 'YYYYMMDD') || '-(.*)') AS INTEGER)), 0) + 1
  INTO next_number
  FROM blanket_po_releases
  WHERE release_number LIKE 'REL-' || TO_CHAR(CURRENT_DATE, 'YYYYMMDD') || '-%';
  
  new_release_number := 'REL-' || TO_CHAR(CURRENT_DATE, 'YYYYMMDD') || '-' || LPAD(next_number::TEXT, 3, '0');
  RETURN new_release_number;
END;
$$;

-- Function to calculate BPO remaining value
CREATE OR REPLACE FUNCTION public.calculate_bpo_remaining_value(p_bpo_id UUID)
RETURNS NUMERIC
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_total_value NUMERIC;
  v_total_released NUMERIC;
BEGIN
  SELECT total_contract_value INTO v_total_value
  FROM blanket_purchase_orders
  WHERE id = p_bpo_id;
  
  SELECT COALESCE(SUM(total_amount), 0) INTO v_total_released
  FROM blanket_po_releases
  WHERE bpo_id = p_bpo_id AND release_status IN ('approved', 'sent', 'received', 'completed');
  
  RETURN v_total_value - v_total_released;
END;
$$;

-- Function to calculate item remaining quantity
CREATE OR REPLACE FUNCTION public.calculate_bpo_item_remaining_quantity(p_bpo_item_id UUID)
RETURNS NUMERIC
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_total_limit NUMERIC;
  v_total_released NUMERIC;
BEGIN
  SELECT total_quantity_limit INTO v_total_limit
  FROM blanket_po_items
  WHERE id = p_bpo_item_id;
  
  IF v_total_limit IS NULL THEN
    RETURN NULL;
  END IF;
  
  SELECT COALESCE(SUM(bri.quantity_approved), 0) INTO v_total_released
  FROM blanket_po_release_items bri
  JOIN blanket_po_releases br ON bri.release_id = br.id
  WHERE bri.bpo_item_id = p_bpo_item_id 
    AND br.release_status IN ('approved', 'sent', 'received', 'completed');
  
  RETURN v_total_limit - v_total_released;
END;
$$;

-- Function to validate BPO release
CREATE OR REPLACE FUNCTION public.validate_bpo_release(p_bpo_id UUID, p_requested_amount NUMERIC)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_remaining_value NUMERIC;
  v_status blanket_contract_status;
  v_end_date DATE;
BEGIN
  SELECT contract_status, contract_end_date, remaining_value
  INTO v_status, v_end_date, v_remaining_value
  FROM blanket_purchase_orders
  WHERE id = p_bpo_id;
  
  -- Check if BPO is active
  IF v_status NOT IN ('active') THEN
    RETURN false;
  END IF;
  
  -- Check if not expired
  IF v_end_date < CURRENT_DATE THEN
    RETURN false;
  END IF;
  
  -- Check if amount is within limit
  IF p_requested_amount > v_remaining_value THEN
    RETURN false;
  END IF;
  
  RETURN true;
END;
$$;

-- Function to calculate utilization
CREATE OR REPLACE FUNCTION public.calculate_bpo_utilization(p_bpo_id UUID)
RETURNS NUMERIC
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_total_value NUMERIC;
  v_remaining_value NUMERIC;
  v_utilization NUMERIC;
BEGIN
  SELECT total_contract_value, remaining_value
  INTO v_total_value, v_remaining_value
  FROM blanket_purchase_orders
  WHERE id = p_bpo_id;
  
  IF v_total_value = 0 THEN
    RETURN 0;
  END IF;
  
  v_utilization := ((v_total_value - v_remaining_value) / v_total_value) * 100;
  RETURN ROUND(v_utilization, 2);
END;
$$;

-- Trigger to auto-generate BPO number
CREATE OR REPLACE FUNCTION public.auto_generate_bpo_number()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.bpo_number IS NULL OR NEW.bpo_number = '' THEN
    NEW.bpo_number := generate_bpo_number();
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trigger_auto_generate_bpo_number
BEFORE INSERT ON public.blanket_purchase_orders
FOR EACH ROW
EXECUTE FUNCTION public.auto_generate_bpo_number();

-- Trigger to auto-generate release number
CREATE OR REPLACE FUNCTION public.auto_generate_release_number()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.release_number IS NULL OR NEW.release_number = '' THEN
    NEW.release_number := generate_release_number();
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trigger_auto_generate_release_number
BEFORE INSERT ON public.blanket_po_releases
FOR EACH ROW
EXECUTE FUNCTION public.auto_generate_release_number();

-- Trigger to update BPO remaining value
CREATE OR REPLACE FUNCTION public.update_bpo_remaining_value()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  UPDATE blanket_purchase_orders
  SET remaining_value = calculate_bpo_remaining_value(COALESCE(NEW.bpo_id, OLD.bpo_id)),
      updated_at = now()
  WHERE id = COALESCE(NEW.bpo_id, OLD.bpo_id);
  
  RETURN COALESCE(NEW, OLD);
END;
$$;

CREATE TRIGGER trigger_update_bpo_remaining_value
AFTER INSERT OR UPDATE OR DELETE ON public.blanket_po_releases
FOR EACH ROW
EXECUTE FUNCTION public.update_bpo_remaining_value();

-- Trigger to update item remaining quantity
CREATE OR REPLACE FUNCTION public.update_bpo_item_remaining_quantity()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  UPDATE blanket_po_items
  SET remaining_quantity = calculate_bpo_item_remaining_quantity(COALESCE(NEW.bpo_item_id, OLD.bpo_item_id)),
      quantity_released = COALESCE((
        SELECT SUM(bri.quantity_approved)
        FROM blanket_po_release_items bri
        JOIN blanket_po_releases br ON bri.release_id = br.id
        WHERE bri.bpo_item_id = COALESCE(NEW.bpo_item_id, OLD.bpo_item_id)
          AND br.release_status IN ('approved', 'sent', 'received', 'completed')
      ), 0),
      updated_at = now()
  WHERE id = COALESCE(NEW.bpo_item_id, OLD.bpo_item_id);
  
  RETURN COALESCE(NEW, OLD);
END;
$$;

CREATE TRIGGER trigger_update_bpo_item_remaining_quantity
AFTER INSERT OR UPDATE OR DELETE ON public.blanket_po_release_items
FOR EACH ROW
EXECUTE FUNCTION public.update_bpo_item_remaining_quantity();

-- Trigger to update release total amount
CREATE OR REPLACE FUNCTION public.update_release_total_amount()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  release_total NUMERIC(15,2);
BEGIN
  SELECT COALESCE(SUM(total_price), 0)
  INTO release_total
  FROM blanket_po_release_items
  WHERE release_id = COALESCE(NEW.release_id, OLD.release_id);
  
  UPDATE blanket_po_releases
  SET total_amount = release_total,
      updated_at = now()
  WHERE id = COALESCE(NEW.release_id, OLD.release_id);
  
  RETURN COALESCE(NEW, OLD);
END;
$$;

CREATE TRIGGER trigger_update_release_total_amount
AFTER INSERT OR UPDATE OR DELETE ON public.blanket_po_release_items
FOR EACH ROW
EXECUTE FUNCTION public.update_release_total_amount();

-- Trigger to initialize remaining value on BPO creation
CREATE OR REPLACE FUNCTION public.initialize_bpo_remaining_value()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.remaining_value := NEW.total_contract_value;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trigger_initialize_bpo_remaining_value
BEFORE INSERT ON public.blanket_purchase_orders
FOR EACH ROW
EXECUTE FUNCTION public.initialize_bpo_remaining_value();

-- Trigger to update updated_at timestamp
CREATE TRIGGER trigger_update_blanket_purchase_orders_updated_at
BEFORE UPDATE ON public.blanket_purchase_orders
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER trigger_update_blanket_po_items_updated_at
BEFORE UPDATE ON public.blanket_po_items
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER trigger_update_blanket_po_releases_updated_at
BEFORE UPDATE ON public.blanket_po_releases
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER trigger_update_blanket_po_release_items_updated_at
BEFORE UPDATE ON public.blanket_po_release_items
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Enable RLS on all tables
ALTER TABLE public.blanket_purchase_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.blanket_po_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.blanket_po_releases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.blanket_po_release_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.blanket_po_amendments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.blanket_po_spending_analytics ENABLE ROW LEVEL SECURITY;

-- RLS Policies for blanket_purchase_orders
CREATE POLICY "Authenticated users can view BPOs"
ON public.blanket_purchase_orders FOR SELECT
TO authenticated
USING (auth.uid() IS NOT NULL);

CREATE POLICY "Users can create BPOs"
ON public.blanket_purchase_orders FOR INSERT
TO authenticated
WITH CHECK (auth.uid() IS NOT NULL AND auth.uid() = created_by);

CREATE POLICY "Users can update their BPOs or admins can update any"
ON public.blanket_purchase_orders FOR UPDATE
TO authenticated
USING (auth.uid() = created_by OR is_admin(auth.uid()));

CREATE POLICY "Admins can delete BPOs"
ON public.blanket_purchase_orders FOR DELETE
TO authenticated
USING (is_admin(auth.uid()));

-- RLS Policies for blanket_po_items
CREATE POLICY "Authenticated users can view BPO items"
ON public.blanket_po_items FOR SELECT
TO authenticated
USING (auth.uid() IS NOT NULL);

CREATE POLICY "Users can manage BPO items for their BPOs"
ON public.blanket_po_items FOR ALL
TO authenticated
USING (EXISTS (
  SELECT 1 FROM blanket_purchase_orders
  WHERE id = blanket_po_items.bpo_id
    AND (created_by = auth.uid() OR is_admin(auth.uid()))
));

-- RLS Policies for blanket_po_releases
CREATE POLICY "Authenticated users can view releases"
ON public.blanket_po_releases FOR SELECT
TO authenticated
USING (auth.uid() IS NOT NULL);

CREATE POLICY "Users can create releases"
ON public.blanket_po_releases FOR INSERT
TO authenticated
WITH CHECK (auth.uid() IS NOT NULL AND auth.uid() = requested_by);

CREATE POLICY "Users can update their releases or admins can update any"
ON public.blanket_po_releases FOR UPDATE
TO authenticated
USING (auth.uid() = requested_by OR is_admin(auth.uid()));

CREATE POLICY "Admins can delete releases"
ON public.blanket_po_releases FOR DELETE
TO authenticated
USING (is_admin(auth.uid()));

-- RLS Policies for blanket_po_release_items
CREATE POLICY "Authenticated users can view release items"
ON public.blanket_po_release_items FOR SELECT
TO authenticated
USING (auth.uid() IS NOT NULL);

CREATE POLICY "Users can manage release items for their releases"
ON public.blanket_po_release_items FOR ALL
TO authenticated
USING (EXISTS (
  SELECT 1 FROM blanket_po_releases
  WHERE id = blanket_po_release_items.release_id
    AND (requested_by = auth.uid() OR is_admin(auth.uid()))
));

-- RLS Policies for blanket_po_amendments
CREATE POLICY "Authenticated users can view amendments"
ON public.blanket_po_amendments FOR SELECT
TO authenticated
USING (auth.uid() IS NOT NULL);

CREATE POLICY "Users can create amendments for their BPOs"
ON public.blanket_po_amendments FOR INSERT
TO authenticated
WITH CHECK (EXISTS (
  SELECT 1 FROM blanket_purchase_orders
  WHERE id = blanket_po_amendments.bpo_id
    AND (created_by = auth.uid() OR is_admin(auth.uid()))
));

CREATE POLICY "Admins can manage amendments"
ON public.blanket_po_amendments FOR ALL
TO authenticated
USING (is_admin(auth.uid()));

-- RLS Policies for blanket_po_spending_analytics
CREATE POLICY "Authenticated users can view analytics"
ON public.blanket_po_spending_analytics FOR SELECT
TO authenticated
USING (auth.uid() IS NOT NULL);

CREATE POLICY "System can manage analytics"
ON public.blanket_po_spending_analytics FOR ALL
TO authenticated
USING (is_admin(auth.uid()));

-- Create indexes for performance
CREATE INDEX idx_blanket_purchase_orders_supplier ON public.blanket_purchase_orders(supplier_id);
CREATE INDEX idx_blanket_purchase_orders_status ON public.blanket_purchase_orders(contract_status);
CREATE INDEX idx_blanket_purchase_orders_dates ON public.blanket_purchase_orders(contract_start_date, contract_end_date);
CREATE INDEX idx_blanket_purchase_orders_company ON public.blanket_purchase_orders(company_id);

CREATE INDEX idx_blanket_po_items_bpo ON public.blanket_po_items(bpo_id);
CREATE INDEX idx_blanket_po_items_warehouse_item ON public.blanket_po_items(warehouse_item_id);

CREATE INDEX idx_blanket_po_releases_bpo ON public.blanket_po_releases(bpo_id);
CREATE INDEX idx_blanket_po_releases_status ON public.blanket_po_releases(release_status);
CREATE INDEX idx_blanket_po_releases_date ON public.blanket_po_releases(release_date);

CREATE INDEX idx_blanket_po_release_items_release ON public.blanket_po_release_items(release_id);
CREATE INDEX idx_blanket_po_release_items_bpo_item ON public.blanket_po_release_items(bpo_item_id);

CREATE INDEX idx_blanket_po_amendments_bpo ON public.blanket_po_amendments(bpo_id);
CREATE INDEX idx_blanket_po_spending_analytics_bpo ON public.blanket_po_spending_analytics(bpo_id);