-- Phase 1: Create sales_order_items table
CREATE TABLE sales_order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sales_order_id UUID NOT NULL REFERENCES sales_orders(id) ON DELETE CASCADE,
  cpo_item_id UUID REFERENCES customer_po_items(id),
  finished_good_id UUID REFERENCES finished_goods(id),
  
  item_name TEXT NOT NULL,
  description TEXT,
  
  -- Quantity tracking through fulfillment stages
  quantity_ordered NUMERIC(15,4) NOT NULL DEFAULT 0,
  quantity_issued NUMERIC(15,4) NOT NULL DEFAULT 0,
  quantity_picked NUMERIC(15,4) NOT NULL DEFAULT 0,
  quantity_packed NUMERIC(15,4) NOT NULL DEFAULT 0,
  quantity_dispatched NUMERIC(15,4) NOT NULL DEFAULT 0,
  
  unit_price NUMERIC(15,2),
  total_price NUMERIC(15,2),
  
  status TEXT NOT NULL DEFAULT 'pending',
  notes TEXT,
  
  company_id UUID REFERENCES companies(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE sales_order_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view sales order items" ON sales_order_items
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "Users can manage items for their sales orders" ON sales_order_items
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM sales_orders so
      WHERE so.id = sales_order_items.sales_order_id
      AND (so.created_by = auth.uid() OR is_admin(auth.uid()))
    )
  );

-- Phase 2: Create finished_goods_issues table
CREATE TABLE finished_goods_issues (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  issue_number TEXT NOT NULL UNIQUE,
  sales_order_id UUID REFERENCES sales_orders(id),
  
  issue_date DATE NOT NULL DEFAULT CURRENT_DATE,
  issued_by UUID REFERENCES auth.users(id),
  
  status TEXT NOT NULL DEFAULT 'draft',
  
  total_items INTEGER DEFAULT 0,
  issued_items INTEGER DEFAULT 0,
  
  notes TEXT,
  company_id UUID REFERENCES companies(id),
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE finished_goods_issues ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view FG issues" ON finished_goods_issues
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "Users can create FG issues" ON finished_goods_issues
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL AND auth.uid() = created_by);

CREATE POLICY "Users can update their FG issues" ON finished_goods_issues
  FOR UPDATE USING (auth.uid() = created_by OR is_admin(auth.uid()));

CREATE POLICY "Admins can delete FG issues" ON finished_goods_issues
  FOR DELETE USING (is_admin(auth.uid()));

-- Phase 3: Create finished_goods_issue_items table
CREATE TABLE finished_goods_issue_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  issue_id UUID NOT NULL REFERENCES finished_goods_issues(id) ON DELETE CASCADE,
  sales_order_item_id UUID REFERENCES sales_order_items(id),
  finished_good_id UUID NOT NULL REFERENCES finished_goods(id),
  
  quantity_to_issue NUMERIC(15,4) NOT NULL,
  quantity_issued NUMERIC(15,4) DEFAULT 0,
  
  from_location_id UUID REFERENCES warehouse_locations(id),
  from_bin_id UUID REFERENCES warehouse_bins(id),
  
  batch_number TEXT,
  serial_numbers JSONB,
  
  status TEXT NOT NULL DEFAULT 'pending',
  notes TEXT,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE finished_goods_issue_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view FG issue items" ON finished_goods_issue_items
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM finished_goods_issues fgi
      WHERE fgi.id = finished_goods_issue_items.issue_id
      AND (fgi.created_by = auth.uid() OR is_admin(auth.uid()))
    )
  );

CREATE POLICY "Users can manage FG issue items" ON finished_goods_issue_items
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM finished_goods_issues fgi
      WHERE fgi.id = finished_goods_issue_items.issue_id
      AND (fgi.created_by = auth.uid() OR is_admin(auth.uid()))
    )
  );

-- Phase 4: Create packing_list_items table
CREATE TABLE packing_list_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  packing_list_id UUID NOT NULL REFERENCES packing_lists(id) ON DELETE CASCADE,
  pick_list_item_id UUID REFERENCES pick_list_items(id),
  sales_order_item_id UUID REFERENCES sales_order_items(id),
  finished_good_id UUID NOT NULL REFERENCES finished_goods(id),
  
  quantity_packed NUMERIC(15,4) NOT NULL,
  package_number TEXT,
  
  serial_numbers JSONB,
  notes TEXT,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE packing_list_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view packing list items" ON packing_list_items
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "Users can manage packing list items" ON packing_list_items
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM packing_lists pl
      WHERE pl.id = packing_list_items.packing_list_id
      AND (pl.created_by = auth.uid() OR is_admin(auth.uid()))
    )
  );

-- Phase 5: Create generate_issue_number function
CREATE OR REPLACE FUNCTION generate_issue_number()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  next_number INTEGER;
  new_issue_number TEXT;
BEGIN
  SELECT COALESCE(MAX(CAST(SUBSTRING(issue_number FROM 'FGISS-' || TO_CHAR(CURRENT_DATE, 'YYYYMMDD') || '-(.*)') AS INTEGER)), 0) + 1
  INTO next_number
  FROM finished_goods_issues
  WHERE issue_number LIKE 'FGISS-' || TO_CHAR(CURRENT_DATE, 'YYYYMMDD') || '-%';
  
  new_issue_number := 'FGISS-' || TO_CHAR(CURRENT_DATE, 'YYYYMMDD') || '-' || LPAD(next_number::TEXT, 3, '0');
  RETURN new_issue_number;
END;
$$;

-- Phase 6: Create auto_generate_issue_number trigger function
CREATE OR REPLACE FUNCTION auto_generate_issue_number()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.issue_number IS NULL OR NEW.issue_number = '' THEN
    NEW.issue_number := generate_issue_number();
  END IF;
  RETURN NEW;
END;
$$;

-- Phase 7: Create trigger for auto-generating issue numbers
CREATE TRIGGER trigger_auto_generate_issue_number
  BEFORE INSERT ON finished_goods_issues
  FOR EACH ROW
  EXECUTE FUNCTION auto_generate_issue_number();

-- Phase 8: Create stock movement trigger on FG issue
CREATE OR REPLACE FUNCTION update_stock_on_fg_issue()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'issued' AND (OLD.status IS NULL OR OLD.status != 'issued') THEN
    -- Create finished goods movements for all issue items
    INSERT INTO finished_goods_movements (
      finished_good_id,
      movement_type,
      reference_type,
      reference_id,
      quantity_change,
      quantity_before,
      quantity_after,
      notes,
      company_id,
      created_by
    )
    SELECT 
      fgii.finished_good_id,
      'issue',
      'sales_order',
      NEW.sales_order_id,
      -fgii.quantity_issued,
      fg.current_stock,
      fg.current_stock - fgii.quantity_issued,
      'Issued for Sales Order: ' || NEW.issue_number,
      NEW.company_id,
      NEW.issued_by
    FROM finished_goods_issue_items fgii
    JOIN finished_goods fg ON fgii.finished_good_id = fg.id
    WHERE fgii.issue_id = NEW.id;

    -- Update sales order item quantities
    UPDATE sales_order_items soi
    SET 
      quantity_issued = soi.quantity_issued + fgii.quantity_issued,
      status = CASE 
        WHEN soi.quantity_issued + fgii.quantity_issued >= soi.quantity_ordered THEN 'issued'
        WHEN soi.quantity_issued + fgii.quantity_issued > 0 THEN 'partial'
        ELSE 'pending'
      END,
      updated_at = NOW()
    FROM finished_goods_issue_items fgii
    WHERE fgii.issue_id = NEW.id
    AND fgii.sales_order_item_id = soi.id;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Phase 9: Create trigger for stock movement on FG issue
CREATE TRIGGER trigger_update_stock_on_fg_issue
  AFTER UPDATE ON finished_goods_issues
  FOR EACH ROW
  EXECUTE FUNCTION update_stock_on_fg_issue();