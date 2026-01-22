-- =============================================
-- CONSTRUCTION INVENTORY ALLOCATION SYSTEM v2
-- Complete Schema Recreation
-- =============================================

-- Clean up any partial tables from failed migrations
DROP TABLE IF EXISTS construction_transfer_items CASCADE;
DROP TABLE IF EXISTS construction_inventory_transfers CASCADE;
DROP TABLE IF EXISTS construction_inventory_transactions CASCADE;
DROP TABLE IF EXISTS construction_repair_records CASCADE;
DROP TABLE IF EXISTS construction_serial_numbers CASCADE;
DROP TABLE IF EXISTS construction_inventory_stock CASCADE;
DROP TABLE IF EXISTS construction_item_master CASCADE;
DROP SEQUENCE IF EXISTS construction_transfer_seq CASCADE;

-- 1. Item Master: Central registry for all inventory items
CREATE TABLE construction_item_master (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
  
  -- Identification
  item_code VARCHAR(50) NOT NULL,
  item_name VARCHAR(255) NOT NULL,
  
  -- Classification
  category VARCHAR(50) NOT NULL CHECK (category IN ('machines', 'tools', 'safety', 'equipment', 'scaffolding', 'others')),
  section VARCHAR(50) NOT NULL CHECK (section IN ('civil', 'mep', 'aluminium', 'mechanical', 'carpenter')),
  
  -- Details
  brand VARCHAR(100),
  model VARCHAR(100),
  unit_of_measurement VARCHAR(20) NOT NULL DEFAULT 'Nos',
  description TEXT,
  image_url TEXT,
  
  -- Tracking configuration
  is_serial_tracked BOOLEAN NOT NULL DEFAULT FALSE,
  
  -- Valuation
  unit_cost NUMERIC(12, 2) DEFAULT 0,
  purchase_date DATE,
  
  -- Status
  status VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'scrap', 'sold')),
  
  -- Audit
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  
  -- Constraints
  UNIQUE(company_id, item_code)
);

-- 2. Serial Number Registry (for machines)
CREATE TABLE construction_serial_numbers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
  item_master_id UUID NOT NULL REFERENCES construction_item_master(id) ON DELETE CASCADE,
  
  -- Serial identification
  serial_number VARCHAR(100) NOT NULL,
  
  -- Current state
  current_location_id UUID REFERENCES warehouse_locations(id),
  condition VARCHAR(30) NOT NULL DEFAULT 'working' CHECK (condition IN ('working', 'under_repair', 'damaged', 'scrap')),
  availability VARCHAR(30) NOT NULL DEFAULT 'available' CHECK (availability IN ('available', 'in_use', 'in_transit', 'reserved')),
  
  -- Additional info
  notes TEXT,
  purchase_date DATE,
  warranty_expiry DATE,
  asset_value NUMERIC(12, 2),
  
  -- Audit
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  
  UNIQUE(company_id, serial_number)
);

-- 3. Stock Balances (for non-serial items)
CREATE TABLE construction_inventory_stock (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
  item_master_id UUID NOT NULL REFERENCES construction_item_master(id) ON DELETE CASCADE,
  location_id UUID NOT NULL REFERENCES warehouse_locations(id),
  
  -- Quantities
  quantity NUMERIC(12, 2) NOT NULL DEFAULT 0 CHECK (quantity >= 0),
  reserved_quantity NUMERIC(12, 2) NOT NULL DEFAULT 0 CHECK (reserved_quantity >= 0),
  
  -- Audit
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  
  -- One stock record per item per location
  UNIQUE(item_master_id, location_id)
);

-- 4. Transfer Records
CREATE TABLE construction_inventory_transfers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
  
  -- Transfer identification
  transfer_number VARCHAR(50) NOT NULL,
  transfer_date TIMESTAMPTZ NOT NULL DEFAULT now(),
  
  -- Locations
  from_location_id UUID NOT NULL REFERENCES warehouse_locations(id),
  to_location_id UUID NOT NULL REFERENCES warehouse_locations(id),
  
  -- Status tracking
  status VARCHAR(30) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'in_transit', 'completed', 'cancelled')),
  
  -- Details
  notes TEXT,
  initiated_by UUID REFERENCES auth.users(id),
  completed_by UUID REFERENCES auth.users(id),
  completed_at TIMESTAMPTZ,
  
  -- Audit
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 5. Transfer Line Items
CREATE TABLE construction_transfer_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  transfer_id UUID NOT NULL REFERENCES construction_inventory_transfers(id) ON DELETE CASCADE,
  item_master_id UUID NOT NULL REFERENCES construction_item_master(id),
  
  -- For non-serial items
  quantity NUMERIC(12, 2),
  
  -- For serial-tracked items
  serial_number_id UUID REFERENCES construction_serial_numbers(id),
  
  -- Validation: either quantity OR serial, not both
  CHECK (
    (quantity IS NOT NULL AND serial_number_id IS NULL) OR
    (quantity IS NULL AND serial_number_id IS NOT NULL)
  )
);

-- 6. Repair Records
CREATE TABLE construction_repair_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
  
  -- Item reference
  item_master_id UUID NOT NULL REFERENCES construction_item_master(id),
  serial_number_id UUID REFERENCES construction_serial_numbers(id),
  
  -- Repair details
  repair_date TIMESTAMPTZ NOT NULL DEFAULT now(),
  expected_return_date DATE,
  actual_return_date DATE,
  
  -- Status
  status VARCHAR(30) NOT NULL DEFAULT 'sent_for_repair' CHECK (status IN ('sent_for_repair', 'in_repair', 'repaired', 'returned', 'discarded')),
  
  -- Cost tracking
  repair_cost NUMERIC(12, 2) DEFAULT 0,
  service_provider VARCHAR(255),
  
  -- Details
  issue_description TEXT,
  repair_notes TEXT,
  
  -- Quantity for non-serial items
  quantity NUMERIC(12, 2) DEFAULT 1,
  
  -- Audit
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 7. Transaction Log (Audit Trail)
CREATE TABLE construction_inventory_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
  
  -- References
  item_master_id UUID REFERENCES construction_item_master(id),
  serial_number_id UUID REFERENCES construction_serial_numbers(id),
  transfer_id UUID REFERENCES construction_inventory_transfers(id),
  repair_id UUID REFERENCES construction_repair_records(id),
  
  -- Transaction details
  transaction_type VARCHAR(50) NOT NULL CHECK (transaction_type IN (
    'stock_in', 'stock_out', 'transfer_out', 'transfer_in', 
    'adjustment', 'repair_sent', 'repair_returned', 'scrap', 'initial_stock'
  )),
  transaction_date TIMESTAMPTZ NOT NULL DEFAULT now(),
  
  -- Quantity change
  quantity_change NUMERIC(12, 2),
  
  -- Location context
  location_id UUID REFERENCES warehouse_locations(id),
  
  -- Details
  notes TEXT,
  performed_by UUID REFERENCES auth.users(id),
  
  -- Audit
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- =============================================
-- INDEXES
-- =============================================
CREATE INDEX idx_cim_company ON construction_item_master(company_id);
CREATE INDEX idx_cim_category ON construction_item_master(category);
CREATE INDEX idx_cim_section ON construction_item_master(section);
CREATE INDEX idx_csn_item ON construction_serial_numbers(item_master_id);
CREATE INDEX idx_csn_location ON construction_serial_numbers(current_location_id);
CREATE INDEX idx_cis_item_loc ON construction_inventory_stock(item_master_id, location_id);
CREATE INDEX idx_cit_status ON construction_inventory_transfers(status);
CREATE INDEX idx_crr_status ON construction_repair_records(status);
CREATE INDEX idx_citx_item ON construction_inventory_transactions(item_master_id);
CREATE INDEX idx_citx_date ON construction_inventory_transactions(transaction_date);

-- =============================================
-- ROW LEVEL SECURITY
-- =============================================
ALTER TABLE construction_item_master ENABLE ROW LEVEL SECURITY;
ALTER TABLE construction_serial_numbers ENABLE ROW LEVEL SECURITY;
ALTER TABLE construction_inventory_stock ENABLE ROW LEVEL SECURITY;
ALTER TABLE construction_inventory_transfers ENABLE ROW LEVEL SECURITY;
ALTER TABLE construction_transfer_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE construction_repair_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE construction_inventory_transactions ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "item_master_select" ON construction_item_master FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "item_master_all" ON construction_item_master FOR ALL USING (auth.uid() IS NOT NULL);
CREATE POLICY "serial_numbers_select" ON construction_serial_numbers FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "serial_numbers_all" ON construction_serial_numbers FOR ALL USING (auth.uid() IS NOT NULL);
CREATE POLICY "stock_select" ON construction_inventory_stock FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "stock_all" ON construction_inventory_stock FOR ALL USING (auth.uid() IS NOT NULL);
CREATE POLICY "transfers_select" ON construction_inventory_transfers FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "transfers_all" ON construction_inventory_transfers FOR ALL USING (auth.uid() IS NOT NULL);
CREATE POLICY "transfer_items_select" ON construction_transfer_items FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "transfer_items_all" ON construction_transfer_items FOR ALL USING (auth.uid() IS NOT NULL);
CREATE POLICY "repairs_select" ON construction_repair_records FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "repairs_all" ON construction_repair_records FOR ALL USING (auth.uid() IS NOT NULL);
CREATE POLICY "transactions_select" ON construction_inventory_transactions FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "transactions_all" ON construction_inventory_transactions FOR ALL USING (auth.uid() IS NOT NULL);

-- =============================================
-- TRIGGERS
-- =============================================
CREATE SEQUENCE construction_transfer_seq START 1;

CREATE OR REPLACE FUNCTION generate_construction_transfer_number()
RETURNS TRIGGER AS $$
BEGIN
  NEW.transfer_number := 'TRF-' || TO_CHAR(NOW(), 'YYYYMMDD') || '-' || 
    LPAD(NEXTVAL('construction_transfer_seq')::TEXT, 4, '0');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_construction_transfer_number
  BEFORE INSERT ON construction_inventory_transfers
  FOR EACH ROW
  WHEN (NEW.transfer_number IS NULL OR NEW.transfer_number = '')
  EXECUTE FUNCTION generate_construction_transfer_number();

CREATE OR REPLACE FUNCTION update_construction_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_cim_timestamp BEFORE UPDATE ON construction_item_master FOR EACH ROW EXECUTE FUNCTION update_construction_timestamp();
CREATE TRIGGER update_csn_timestamp BEFORE UPDATE ON construction_serial_numbers FOR EACH ROW EXECUTE FUNCTION update_construction_timestamp();
CREATE TRIGGER update_cis_timestamp BEFORE UPDATE ON construction_inventory_stock FOR EACH ROW EXECUTE FUNCTION update_construction_timestamp();
CREATE TRIGGER update_cit_timestamp BEFORE UPDATE ON construction_inventory_transfers FOR EACH ROW EXECUTE FUNCTION update_construction_timestamp();
CREATE TRIGGER update_crr_timestamp BEFORE UPDATE ON construction_repair_records FOR EACH ROW EXECUTE FUNCTION update_construction_timestamp();