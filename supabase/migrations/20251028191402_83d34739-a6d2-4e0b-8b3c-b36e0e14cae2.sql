-- Phase 1: Material Reservation System - Database Schema

-- 1. Create warehouse_bin_allocations table
CREATE TABLE IF NOT EXISTS warehouse_bin_allocations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  warehouse_item_id UUID NOT NULL REFERENCES warehouse_items(id) ON DELETE CASCADE,
  bin_id UUID NOT NULL REFERENCES warehouse_bins(id) ON DELETE CASCADE,
  allocated_quantity NUMERIC(15,2) NOT NULL DEFAULT 0,
  reserved_quantity NUMERIC(15,2) NOT NULL DEFAULT 0,
  available_quantity NUMERIC(15,2) GENERATED ALWAYS AS (allocated_quantity - reserved_quantity) STORED,
  notes TEXT,
  company_id UUID REFERENCES companies(id),
  created_by UUID REFERENCES profiles(user_id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT positive_quantities CHECK (allocated_quantity >= 0 AND reserved_quantity >= 0),
  CONSTRAINT sufficient_stock CHECK (reserved_quantity <= allocated_quantity)
);

CREATE INDEX IF NOT EXISTS idx_bin_allocations_item ON warehouse_bin_allocations(warehouse_item_id);
CREATE INDEX IF NOT EXISTS idx_bin_allocations_bin ON warehouse_bin_allocations(bin_id);
CREATE INDEX IF NOT EXISTS idx_bin_allocations_company ON warehouse_bin_allocations(company_id);

-- RLS policies for warehouse_bin_allocations
ALTER TABLE warehouse_bin_allocations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view bin allocations"
  ON warehouse_bin_allocations FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Users can create bin allocations"
  ON warehouse_bin_allocations FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL AND auth.uid() = created_by);

CREATE POLICY "Users can update their bin allocations or admins can update"
  ON warehouse_bin_allocations FOR UPDATE
  USING (auth.uid() = created_by OR is_admin(auth.uid()));

CREATE POLICY "Admins can delete bin allocations"
  ON warehouse_bin_allocations FOR DELETE
  USING (is_admin(auth.uid()));

-- 2. Create warehouse_item_reservations table
CREATE TABLE IF NOT EXISTS warehouse_item_reservations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  warehouse_item_id UUID NOT NULL REFERENCES warehouse_items(id) ON DELETE CASCADE,
  bin_allocation_id UUID REFERENCES warehouse_bin_allocations(id) ON DELETE SET NULL,
  reserved_quantity NUMERIC(15,2) NOT NULL,
  
  -- Reference tracking
  reference_type TEXT NOT NULL CHECK (reference_type IN ('cpo', 'material_request', 'production_order', 'sales_order', 'manual')),
  reference_id UUID,
  reference_number TEXT,
  
  -- Dates
  reserved_date DATE NOT NULL DEFAULT CURRENT_DATE,
  required_date DATE,
  expiry_date DATE,
  
  -- Status workflow
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'partially_issued', 'issued', 'expired', 'cancelled')),
  
  -- Tracking
  quantity_issued NUMERIC(15,2) DEFAULT 0,
  quantity_remaining NUMERIC(15,2) GENERATED ALWAYS AS (reserved_quantity - quantity_issued) STORED,
  
  -- BOM linkage
  bom_id UUID REFERENCES bill_of_materials(id),
  bom_item_id UUID REFERENCES bom_items(id),
  
  notes TEXT,
  company_id UUID REFERENCES companies(id),
  reserved_by UUID REFERENCES profiles(user_id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  
  CONSTRAINT positive_reserved_qty CHECK (reserved_quantity > 0),
  CONSTRAINT valid_issued_qty CHECK (quantity_issued >= 0 AND quantity_issued <= reserved_quantity)
);

CREATE INDEX IF NOT EXISTS idx_item_reservations_item ON warehouse_item_reservations(warehouse_item_id);
CREATE INDEX IF NOT EXISTS idx_item_reservations_reference ON warehouse_item_reservations(reference_type, reference_id);
CREATE INDEX IF NOT EXISTS idx_item_reservations_bin_allocation ON warehouse_item_reservations(bin_allocation_id);
CREATE INDEX IF NOT EXISTS idx_item_reservations_status ON warehouse_item_reservations(status);
CREATE INDEX IF NOT EXISTS idx_item_reservations_company ON warehouse_item_reservations(company_id);
CREATE INDEX IF NOT EXISTS idx_item_reservations_bom ON warehouse_item_reservations(bom_id);

-- RLS policies for warehouse_item_reservations
ALTER TABLE warehouse_item_reservations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view reservations"
  ON warehouse_item_reservations FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Users can create reservations"
  ON warehouse_item_reservations FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL AND auth.uid() = reserved_by);

CREATE POLICY "Users can update their reservations or admins can update"
  ON warehouse_item_reservations FOR UPDATE
  USING (auth.uid() = reserved_by OR is_admin(auth.uid()));

CREATE POLICY "Admins can delete reservations"
  ON warehouse_item_reservations FOR DELETE
  USING (is_admin(auth.uid()));

-- 3. Add reserved_quantity column to warehouse_items if not exists
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'warehouse_items' 
    AND column_name = 'reserved_quantity'
  ) THEN
    ALTER TABLE warehouse_items ADD COLUMN reserved_quantity NUMERIC(15,2) DEFAULT 0;
  END IF;
END $$;

-- 4. Create trigger function to update warehouse item reserved quantities
CREATE OR REPLACE FUNCTION update_warehouse_item_reservations()
RETURNS TRIGGER AS $$
BEGIN
  -- Update the warehouse item's reserved_quantity
  UPDATE warehouse_items
  SET reserved_quantity = (
    SELECT COALESCE(SUM(reserved_quantity - quantity_issued), 0)
    FROM warehouse_item_reservations
    WHERE warehouse_item_id = COALESCE(NEW.warehouse_item_id, OLD.warehouse_item_id)
      AND status IN ('active', 'partially_issued')
  )
  WHERE id = COALESCE(NEW.warehouse_item_id, OLD.warehouse_item_id);
  
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- Drop trigger if exists and create new one
DROP TRIGGER IF EXISTS trg_update_item_reservations ON warehouse_item_reservations;
CREATE TRIGGER trg_update_item_reservations
AFTER INSERT OR UPDATE OR DELETE ON warehouse_item_reservations
FOR EACH ROW
EXECUTE FUNCTION update_warehouse_item_reservations();

-- 5. Create trigger function to update bin allocation reserved quantities
CREATE OR REPLACE FUNCTION update_bin_allocation_reservations()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.bin_allocation_id IS NOT NULL THEN
    UPDATE warehouse_bin_allocations
    SET reserved_quantity = (
      SELECT COALESCE(SUM(reserved_quantity - quantity_issued), 0)
      FROM warehouse_item_reservations
      WHERE bin_allocation_id = NEW.bin_allocation_id
        AND status IN ('active', 'partially_issued')
    )
    WHERE id = NEW.bin_allocation_id;
  END IF;
  
  IF TG_OP = 'UPDATE' AND OLD.bin_allocation_id IS NOT NULL AND OLD.bin_allocation_id != NEW.bin_allocation_id THEN
    UPDATE warehouse_bin_allocations
    SET reserved_quantity = (
      SELECT COALESCE(SUM(reserved_quantity - quantity_issued), 0)
      FROM warehouse_item_reservations
      WHERE bin_allocation_id = OLD.bin_allocation_id
        AND status IN ('active', 'partially_issued')
    )
    WHERE id = OLD.bin_allocation_id;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop trigger if exists and create new one
DROP TRIGGER IF EXISTS trg_update_bin_reservations ON warehouse_item_reservations;
CREATE TRIGGER trg_update_bin_reservations
AFTER INSERT OR UPDATE ON warehouse_item_reservations
FOR EACH ROW
WHEN (NEW.bin_allocation_id IS NOT NULL)
EXECUTE FUNCTION update_bin_allocation_reservations();

-- 6. Create trigger to auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_bin_allocations_updated_at ON warehouse_bin_allocations;
CREATE TRIGGER update_bin_allocations_updated_at
BEFORE UPDATE ON warehouse_bin_allocations
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_item_reservations_updated_at ON warehouse_item_reservations;
CREATE TRIGGER update_item_reservations_updated_at
BEFORE UPDATE ON warehouse_item_reservations
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();