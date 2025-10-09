-- Create delivery_orders table
CREATE TABLE delivery_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  do_number TEXT NOT NULL UNIQUE,
  sales_order_id UUID NOT NULL REFERENCES sales_orders(id),
  packing_list_id UUID REFERENCES packing_lists(id),
  customer_id UUID NOT NULL REFERENCES customers(id),
  
  -- Delivery Information
  delivery_address TEXT NOT NULL,
  delivery_contact TEXT,
  delivery_phone TEXT,
  delivery_date DATE NOT NULL,
  delivery_time_slot TEXT, -- 'morning', 'afternoon', 'evening'
  
  -- Logistics
  vehicle_type TEXT, -- 'truck', 'van', 'motorcycle', 'courier'
  vehicle_number TEXT,
  driver_name TEXT,
  driver_phone TEXT,
  
  -- Status & Workflow
  status TEXT NOT NULL DEFAULT 'draft', 
    -- 'draft', 'approved', 'ready_for_dispatch', 'dispatched', 
    -- 'in_transit', 'delivered', 'failed', 'cancelled'
  priority TEXT DEFAULT 'medium', -- 'low', 'medium', 'high', 'urgent'
  
  -- Approval
  approved_by UUID REFERENCES auth.users(id),
  approved_date TIMESTAMPTZ,
  approval_notes TEXT,
  
  -- Documentation
  special_instructions TEXT,
  delivery_instructions TEXT,
  internal_notes TEXT,
  
  -- Items Summary
  total_packages INTEGER DEFAULT 0,
  total_weight NUMERIC(10,2),
  total_volume NUMERIC(10,2),
  
  -- Tracking
  company_id UUID REFERENCES companies(id),
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_do_sales_order ON delivery_orders(sales_order_id);
CREATE INDEX idx_do_customer ON delivery_orders(customer_id);
CREATE INDEX idx_do_status ON delivery_orders(status);
CREATE INDEX idx_do_delivery_date ON delivery_orders(delivery_date);

-- Create delivery_order_items table
CREATE TABLE delivery_order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  do_id UUID NOT NULL REFERENCES delivery_orders(id) ON DELETE CASCADE,
  sales_order_item_id UUID REFERENCES sales_order_items(id),
  packing_list_item_id UUID REFERENCES packing_list_items(id),
  finished_good_id UUID NOT NULL REFERENCES finished_goods(id),
  
  -- Quantity Details
  quantity_ordered NUMERIC(10,2) NOT NULL,
  quantity_to_deliver NUMERIC(10,2) NOT NULL,
  quantity_delivered NUMERIC(10,2) DEFAULT 0,
  
  -- Package Details
  package_number TEXT,
  batch_number TEXT,
  serial_numbers JSONB,
  
  -- Item Specifications
  item_condition TEXT DEFAULT 'good', -- 'good', 'damaged', 'returned'
  quality_checked BOOLEAN DEFAULT false,
  
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_do_items_do ON delivery_order_items(do_id);
CREATE INDEX idx_do_items_fg ON delivery_order_items(finished_good_id);

-- Auto-generate DO Number Function
CREATE OR REPLACE FUNCTION generate_do_number()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  next_number INTEGER;
  new_do_number TEXT;
BEGIN
  SELECT COALESCE(MAX(CAST(SUBSTRING(do_number FROM 'DO-' || TO_CHAR(CURRENT_DATE, 'YYYYMMDD') || '-(.*)') AS INTEGER)), 0) + 1
  INTO next_number
  FROM delivery_orders
  WHERE do_number LIKE 'DO-' || TO_CHAR(CURRENT_DATE, 'YYYYMMDD') || '-%';
  
  new_do_number := 'DO-' || TO_CHAR(CURRENT_DATE, 'YYYYMMDD') || '-' || LPAD(next_number::TEXT, 3, '0');
  RETURN new_do_number;
END;
$$;

-- Trigger function to auto-generate DO number
CREATE OR REPLACE FUNCTION auto_generate_do_number()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.do_number IS NULL OR NEW.do_number = '' THEN
    NEW.do_number := generate_do_number();
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trigger_auto_generate_do_number
  BEFORE INSERT ON delivery_orders
  FOR EACH ROW
  EXECUTE FUNCTION auto_generate_do_number();

-- Update Sales Order Status Trigger
CREATE OR REPLACE FUNCTION update_so_on_do_creation()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'approved' THEN
    UPDATE sales_orders
    SET status = 'ready_for_dispatch',
        updated_at = NOW()
    WHERE id = NEW.sales_order_id;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trigger_update_so_on_do
  AFTER INSERT OR UPDATE ON delivery_orders
  FOR EACH ROW
  EXECUTE FUNCTION update_so_on_do_creation();

-- Enable RLS
ALTER TABLE delivery_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE delivery_order_items ENABLE ROW LEVEL SECURITY;

-- RLS Policies for delivery_orders
CREATE POLICY "Users can view delivery orders"
  ON delivery_orders FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Users can create delivery orders"
  ON delivery_orders FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL AND auth.uid() = created_by);

CREATE POLICY "Users can update their DOs"
  ON delivery_orders FOR UPDATE
  USING (auth.uid() = created_by OR is_admin(auth.uid()));

CREATE POLICY "Admins can delete DOs"
  ON delivery_orders FOR DELETE
  USING (is_admin(auth.uid()));

-- RLS Policies for delivery_order_items
CREATE POLICY "Users can view DO items"
  ON delivery_order_items FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Users can manage DO items"
  ON delivery_order_items FOR ALL
  USING (EXISTS (
    SELECT 1 FROM delivery_orders
    WHERE delivery_orders.id = delivery_order_items.do_id
    AND (delivery_orders.created_by = auth.uid() OR is_admin(auth.uid()))
  ));

-- Update dispatch_records to link to delivery orders
ALTER TABLE dispatch_records 
ADD COLUMN delivery_order_id UUID REFERENCES delivery_orders(id);

CREATE INDEX idx_dispatch_do ON dispatch_records(delivery_order_id);