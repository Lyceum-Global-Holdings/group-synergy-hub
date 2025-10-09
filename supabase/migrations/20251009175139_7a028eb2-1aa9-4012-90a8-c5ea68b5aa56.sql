-- Create cycle count schedules table
CREATE TABLE cycle_count_schedules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  schedule_name TEXT NOT NULL,
  schedule_type TEXT NOT NULL, -- 'abc_analysis', 'location_based', 'item_based', 'random'
  frequency TEXT NOT NULL, -- 'daily', 'weekly', 'monthly', 'quarterly'
  priority TEXT NOT NULL DEFAULT 'normal', -- 'low', 'normal', 'high', 'urgent'
  
  -- Selection criteria
  location_ids UUID[], -- Array of location IDs
  category_ids UUID[], -- Array of category IDs
  item_ids UUID[], -- Specific items
  abc_classification TEXT, -- 'A', 'B', 'C' (for ABC analysis)
  
  -- Schedule settings
  next_count_date DATE,
  last_count_date DATE,
  count_per_cycle INTEGER DEFAULT 10, -- Number of items to count per cycle
  
  status TEXT NOT NULL DEFAULT 'active', -- 'active', 'inactive', 'completed'
  
  company_id UUID,
  created_by UUID,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create cycle counts table
CREATE TABLE cycle_counts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  count_number TEXT NOT NULL UNIQUE,
  schedule_id UUID REFERENCES cycle_count_schedules(id) ON DELETE SET NULL,
  
  count_date DATE NOT NULL DEFAULT CURRENT_DATE,
  count_type TEXT NOT NULL DEFAULT 'scheduled', -- 'scheduled', 'ad_hoc', 'exception'
  status TEXT NOT NULL DEFAULT 'draft', -- 'draft', 'in_progress', 'completed', 'cancelled'
  
  -- Counting details
  location_id UUID,
  assigned_to UUID,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  
  -- Results summary
  total_items_to_count INTEGER DEFAULT 0,
  items_counted INTEGER DEFAULT 0,
  items_with_variance INTEGER DEFAULT 0,
  total_variance_value NUMERIC(15,2) DEFAULT 0,
  
  -- Approval
  approved_by UUID,
  approved_date TIMESTAMPTZ,
  approval_notes TEXT,
  
  notes TEXT,
  company_id UUID,
  created_by UUID,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create cycle count items table
CREATE TABLE cycle_count_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cycle_count_id UUID NOT NULL REFERENCES cycle_counts(id) ON DELETE CASCADE,
  
  warehouse_item_id UUID NOT NULL,
  bin_id UUID,
  
  -- Expected values
  system_quantity NUMERIC(15,4) NOT NULL,
  system_value NUMERIC(15,2),
  
  -- Counted values
  physical_quantity NUMERIC(15,4),
  physical_value NUMERIC(15,2),
  
  -- Variance
  variance_quantity NUMERIC(15,4),
  variance_value NUMERIC(15,2),
  variance_percentage NUMERIC(5,2),
  
  -- Count details
  counted_by UUID,
  counted_at TIMESTAMPTZ,
  recount_required BOOLEAN DEFAULT FALSE,
  recount_count INTEGER DEFAULT 0,
  
  -- Investigation
  variance_reason TEXT, -- 'damaged', 'stolen', 'misplaced', 'system_error', 'other'
  investigation_notes TEXT,
  
  status TEXT NOT NULL DEFAULT 'pending', -- 'pending', 'counted', 'variance_review', 'approved', 'adjusted'
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create cycle count adjustments table
CREATE TABLE cycle_count_adjustments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cycle_count_id UUID NOT NULL REFERENCES cycle_counts(id),
  cycle_count_item_id UUID NOT NULL REFERENCES cycle_count_items(id),
  
  adjustment_type TEXT NOT NULL, -- 'increase', 'decrease'
  adjustment_quantity NUMERIC(15,4) NOT NULL,
  adjustment_value NUMERIC(15,2),
  
  reason TEXT NOT NULL,
  stock_transaction_id UUID,
  
  approved_by UUID,
  approved_date TIMESTAMPTZ,
  
  company_id UUID,
  created_by UUID,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Function to auto-generate cycle count number
CREATE OR REPLACE FUNCTION generate_cycle_count_number()
RETURNS TEXT AS $$
DECLARE
  next_number INTEGER;
  new_count_number TEXT;
BEGIN
  SELECT COALESCE(MAX(CAST(SUBSTRING(count_number FROM 'CC-' || TO_CHAR(CURRENT_DATE, 'YYYYMMDD') || '-(.*)') AS INTEGER)), 0) + 1
  INTO next_number
  FROM cycle_counts
  WHERE count_number LIKE 'CC-' || TO_CHAR(CURRENT_DATE, 'YYYYMMDD') || '-%';
  
  new_count_number := 'CC-' || TO_CHAR(CURRENT_DATE, 'YYYYMMDD') || '-' || LPAD(next_number::TEXT, 3, '0');
  RETURN new_count_number;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION auto_generate_cycle_count_number()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.count_number IS NULL OR NEW.count_number = '' THEN
    NEW.count_number := generate_cycle_count_number();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trigger_auto_generate_cycle_count_number
  BEFORE INSERT ON cycle_counts
  FOR EACH ROW
  EXECUTE FUNCTION auto_generate_cycle_count_number();

-- Function to calculate variance automatically
CREATE OR REPLACE FUNCTION calculate_cycle_count_variance()
RETURNS TRIGGER AS $$
BEGIN
  -- Calculate variance when physical quantity is entered
  IF NEW.physical_quantity IS NOT NULL THEN
    NEW.variance_quantity := NEW.physical_quantity - NEW.system_quantity;
    
    IF NEW.system_quantity > 0 THEN
      NEW.variance_percentage := (NEW.variance_quantity / NEW.system_quantity) * 100;
    ELSE
      NEW.variance_percentage := 100;
    END IF;
    
    -- Calculate value variance if values are provided
    IF NEW.physical_value IS NOT NULL AND NEW.system_value IS NOT NULL THEN
      NEW.variance_value := NEW.physical_value - NEW.system_value;
    END IF;
    
    -- Auto-update status based on variance
    IF ABS(NEW.variance_quantity) > 0 THEN
      NEW.status := 'variance_review';
    ELSE
      NEW.status := 'counted';
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_calculate_cycle_count_variance
  BEFORE INSERT OR UPDATE ON cycle_count_items
  FOR EACH ROW
  EXECUTE FUNCTION calculate_cycle_count_variance();

-- Function to update cycle count summary
CREATE OR REPLACE FUNCTION update_cycle_count_summary()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE cycle_counts
  SET 
    items_counted = (
      SELECT COUNT(*) 
      FROM cycle_count_items 
      WHERE cycle_count_id = COALESCE(NEW.cycle_count_id, OLD.cycle_count_id)
      AND status IN ('counted', 'variance_review', 'approved', 'adjusted')
    ),
    items_with_variance = (
      SELECT COUNT(*) 
      FROM cycle_count_items 
      WHERE cycle_count_id = COALESCE(NEW.cycle_count_id, OLD.cycle_count_id)
      AND ABS(variance_quantity) > 0
    ),
    total_variance_value = (
      SELECT COALESCE(SUM(ABS(variance_value)), 0)
      FROM cycle_count_items 
      WHERE cycle_count_id = COALESCE(NEW.cycle_count_id, OLD.cycle_count_id)
    ),
    updated_at = NOW()
  WHERE id = COALESCE(NEW.cycle_count_id, OLD.cycle_count_id);
  
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_cycle_count_summary
  AFTER INSERT OR UPDATE OR DELETE ON cycle_count_items
  FOR EACH ROW
  EXECUTE FUNCTION update_cycle_count_summary();

-- RLS Policies for cycle_count_schedules
ALTER TABLE cycle_count_schedules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view schedules" ON cycle_count_schedules
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "Users can create schedules" ON cycle_count_schedules
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL AND auth.uid() = created_by);

CREATE POLICY "Users can update schedules they created or admins can update any" ON cycle_count_schedules
  FOR UPDATE USING (auth.uid() = created_by OR is_admin(auth.uid()));

CREATE POLICY "Admins can delete schedules" ON cycle_count_schedules
  FOR DELETE USING (is_admin(auth.uid()));

-- RLS Policies for cycle_counts
ALTER TABLE cycle_counts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view cycle counts" ON cycle_counts
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "Users can create cycle counts" ON cycle_counts
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL AND auth.uid() = created_by);

CREATE POLICY "Users can update cycle counts they created or are assigned to" ON cycle_counts
  FOR UPDATE USING (
    auth.uid() = created_by OR 
    auth.uid() = assigned_to OR 
    is_admin(auth.uid())
  );

CREATE POLICY "Admins can delete cycle counts" ON cycle_counts
  FOR DELETE USING (is_admin(auth.uid()));

-- RLS Policies for cycle_count_items
ALTER TABLE cycle_count_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view cycle count items" ON cycle_count_items
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "Users can manage items for cycle counts they have access to" ON cycle_count_items
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM cycle_counts cc
      WHERE cc.id = cycle_count_items.cycle_count_id
      AND (cc.created_by = auth.uid() OR cc.assigned_to = auth.uid() OR is_admin(auth.uid()))
    )
  );

-- RLS Policies for cycle_count_adjustments
ALTER TABLE cycle_count_adjustments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view adjustments" ON cycle_count_adjustments
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "Admins can create adjustments" ON cycle_count_adjustments
  FOR INSERT WITH CHECK (is_admin(auth.uid()));

CREATE POLICY "Admins can manage adjustments" ON cycle_count_adjustments
  FOR ALL USING (is_admin(auth.uid()));