-- Create enum types
CREATE TYPE widget_type AS ENUM ('kpi_card', 'line_chart', 'bar_chart', 'pie_chart', 'table', 'gauge', 'area_chart');
CREATE TYPE dashboard_visibility AS ENUM ('private', 'role_based', 'company_wide');
CREATE TYPE kpi_category AS ENUM ('procurement', 'warehouse', 'finance', 'sourcing', 'custom');
CREATE TYPE calculation_type AS ENUM ('count', 'sum', 'average', 'percentage', 'custom_sql');
CREATE TYPE permission_level AS ENUM ('view', 'edit', 'admin');

-- Create dashboards table
CREATE TABLE dashboards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  layout_config JSONB DEFAULT '[]'::jsonb,
  is_default BOOLEAN DEFAULT false,
  visibility dashboard_visibility DEFAULT 'private',
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Create kpi_definitions table
CREATE TABLE kpi_definitions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  category kpi_category DEFAULT 'custom',
  data_source TEXT,
  calculation_type calculation_type DEFAULT 'count',
  sql_query TEXT,
  target_value NUMERIC,
  unit TEXT DEFAULT 'items',
  refresh_interval INTEGER DEFAULT 300,
  is_system BOOLEAN DEFAULT false,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Create dashboard_widgets table
CREATE TABLE dashboard_widgets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dashboard_id UUID REFERENCES dashboards(id) ON DELETE CASCADE NOT NULL,
  kpi_id UUID REFERENCES kpi_definitions(id) ON DELETE SET NULL,
  widget_type widget_type NOT NULL,
  title TEXT NOT NULL,
  position_x INTEGER DEFAULT 0,
  position_y INTEGER DEFAULT 0,
  width INTEGER DEFAULT 4,
  height INTEGER DEFAULT 2,
  config JSONB DEFAULT '{}'::jsonb,
  filter_config JSONB,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Create dashboard_permissions table
CREATE TABLE dashboard_permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dashboard_id UUID REFERENCES dashboards(id) ON DELETE CASCADE NOT NULL,
  role_id UUID REFERENCES roles(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  permission_level permission_level DEFAULT 'view',
  created_at TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT check_role_or_user CHECK (role_id IS NOT NULL OR user_id IS NOT NULL)
);

-- Create kpi_history table
CREATE TABLE kpi_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  kpi_id UUID REFERENCES kpi_definitions(id) ON DELETE CASCADE NOT NULL,
  value NUMERIC NOT NULL,
  calculated_at TIMESTAMPTZ DEFAULT now(),
  metadata JSONB
);

-- Create indexes
CREATE INDEX idx_dashboards_company ON dashboards(company_id);
CREATE INDEX idx_dashboards_created_by ON dashboards(created_by);
CREATE INDEX idx_kpi_definitions_company ON kpi_definitions(company_id);
CREATE INDEX idx_kpi_definitions_category ON kpi_definitions(category);
CREATE INDEX idx_dashboard_widgets_dashboard ON dashboard_widgets(dashboard_id);
CREATE INDEX idx_dashboard_widgets_kpi ON dashboard_widgets(kpi_id);
CREATE INDEX idx_kpi_history_kpi ON kpi_history(kpi_id);
CREATE INDEX idx_kpi_history_calculated ON kpi_history(calculated_at DESC);

-- Enable RLS
ALTER TABLE dashboards ENABLE ROW LEVEL SECURITY;
ALTER TABLE kpi_definitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE dashboard_widgets ENABLE ROW LEVEL SECURITY;
ALTER TABLE dashboard_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE kpi_history ENABLE ROW LEVEL SECURITY;

-- RLS Policies for dashboards
CREATE POLICY "Users can view dashboards they have access to"
  ON dashboards FOR SELECT
  USING (
    auth.uid() IS NOT NULL AND (
      created_by = auth.uid() OR
      visibility = 'company_wide' OR
      is_admin(auth.uid()) OR
      EXISTS (
        SELECT 1 FROM dashboard_permissions
        WHERE dashboard_id = dashboards.id
        AND (user_id = auth.uid() OR role_id IN (SELECT role_id FROM user_roles WHERE user_id = auth.uid()))
      )
    )
  );

CREATE POLICY "Users can create dashboards"
  ON dashboards FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL AND auth.uid() = created_by);

CREATE POLICY "Users can update their own dashboards or admins can update any"
  ON dashboards FOR UPDATE
  USING (auth.uid() = created_by OR is_admin(auth.uid()));

CREATE POLICY "Users can delete their own dashboards or admins can delete any"
  ON dashboards FOR DELETE
  USING (auth.uid() = created_by OR is_admin(auth.uid()));

-- RLS Policies for kpi_definitions
CREATE POLICY "Users can view KPI definitions"
  ON kpi_definitions FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Users can create KPI definitions"
  ON kpi_definitions FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL AND auth.uid() = created_by);

CREATE POLICY "Users can update their KPIs or admins can update any"
  ON kpi_definitions FOR UPDATE
  USING (auth.uid() = created_by OR is_admin(auth.uid()));

CREATE POLICY "Users can delete their KPIs or admins can delete any"
  ON kpi_definitions FOR DELETE
  USING (auth.uid() = created_by OR is_admin(auth.uid()));

-- RLS Policies for dashboard_widgets
CREATE POLICY "Users can view widgets for accessible dashboards"
  ON dashboard_widgets FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM dashboards
      WHERE dashboards.id = dashboard_widgets.dashboard_id
      AND (created_by = auth.uid() OR visibility = 'company_wide' OR is_admin(auth.uid()))
    )
  );

CREATE POLICY "Users can manage widgets for their dashboards"
  ON dashboard_widgets FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM dashboards
      WHERE dashboards.id = dashboard_widgets.dashboard_id
      AND (created_by = auth.uid() OR is_admin(auth.uid()))
    )
  );

-- RLS Policies for dashboard_permissions
CREATE POLICY "Users can view permissions for their dashboards"
  ON dashboard_permissions FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM dashboards
      WHERE dashboards.id = dashboard_permissions.dashboard_id
      AND (created_by = auth.uid() OR is_admin(auth.uid()))
    )
  );

CREATE POLICY "Dashboard owners can manage permissions"
  ON dashboard_permissions FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM dashboards
      WHERE dashboards.id = dashboard_permissions.dashboard_id
      AND (created_by = auth.uid() OR is_admin(auth.uid()))
    )
  );

-- RLS Policies for kpi_history
CREATE POLICY "Users can view KPI history"
  ON kpi_history FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "System can insert KPI history"
  ON kpi_history FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

-- Function to calculate KPI value
CREATE OR REPLACE FUNCTION calculate_kpi_value(p_kpi_id UUID)
RETURNS NUMERIC AS $$
DECLARE
  v_kpi RECORD;
  v_result NUMERIC;
BEGIN
  SELECT * INTO v_kpi FROM kpi_definitions WHERE id = p_kpi_id;
  
  IF v_kpi.calculation_type = 'custom_sql' AND v_kpi.sql_query IS NOT NULL THEN
    EXECUTE v_kpi.sql_query INTO v_result;
  ELSE
    v_result := 0;
  END IF;
  
  -- Store in history
  INSERT INTO kpi_history (kpi_id, value, calculated_at)
  VALUES (p_kpi_id, v_result, now());
  
  RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Insert system KPI definitions
INSERT INTO kpi_definitions (name, description, category, calculation_type, sql_query, unit, is_system) VALUES
-- Procurement KPIs
('Total Purchase Orders', 'Total number of purchase orders', 'procurement', 'custom_sql', 'SELECT COUNT(*)::numeric FROM purchase_orders', 'orders', true),
('Pending PO Approvals', 'Purchase orders awaiting approval', 'procurement', 'custom_sql', 'SELECT COUNT(*)::numeric FROM purchase_orders WHERE status = ''pending''', 'orders', true),
('Monthly Procurement Spend', 'Total procurement spend this month', 'procurement', 'custom_sql', 'SELECT COALESCE(SUM(total_amount), 0) FROM purchase_orders WHERE DATE_TRUNC(''month'', order_date) = DATE_TRUNC(''month'', CURRENT_DATE)', 'Rs.', true),
('Active Purchase Requisitions', 'Purchase requisitions in progress', 'procurement', 'custom_sql', 'SELECT COUNT(*)::numeric FROM purchase_requisitions WHERE status NOT IN (''cancelled'', ''completed'')', 'requisitions', true),

-- Warehouse KPIs
('Total Stock Value', 'Total value of inventory', 'warehouse', 'custom_sql', 'SELECT COALESCE(SUM(quantity * unit_price), 0) FROM warehouse_items', 'Rs.', true),
('Pending GRNs', 'Goods receipt notes pending processing', 'warehouse', 'custom_sql', 'SELECT COUNT(*)::numeric FROM goods_receipt_notes WHERE status = ''pending''', 'GRNs', true),
('Total Warehouse Items', 'Total number of items in warehouse', 'warehouse', 'custom_sql', 'SELECT COUNT(*)::numeric FROM warehouse_items', 'items', true),
('Low Stock Items', 'Items below reorder level', 'warehouse', 'custom_sql', 'SELECT COUNT(*)::numeric FROM warehouse_items WHERE quantity < reorder_level', 'items', true),

-- Finance KPIs
('Total Journal Entries', 'Total journal entries recorded', 'finance', 'custom_sql', 'SELECT COUNT(*)::numeric FROM journal_entries', 'entries', true),
('Monthly Journal Entries', 'Journal entries this month', 'finance', 'custom_sql', 'SELECT COUNT(*)::numeric FROM journal_entries WHERE DATE_TRUNC(''month'', entry_date) = DATE_TRUNC(''month'', CURRENT_DATE)', 'entries', true),
('Active Accounting Periods', 'Currently open accounting periods', 'finance', 'custom_sql', 'SELECT COUNT(*)::numeric FROM accounting_periods WHERE status = ''open''', 'periods', true),

-- Sourcing KPIs
('Active Suppliers', 'Total active suppliers', 'sourcing', 'custom_sql', 'SELECT COUNT(*)::numeric FROM suppliers WHERE status = ''active''', 'suppliers', true),
('Average Supplier Rating', 'Mean rating of all suppliers', 'sourcing', 'custom_sql', 'SELECT COALESCE(AVG(overall_rating), 0) FROM suppliers WHERE overall_rating IS NOT NULL', 'rating', true),
('Suppliers Under Review', 'Suppliers with active risk flags', 'sourcing', 'custom_sql', 'SELECT COUNT(DISTINCT supplier_id)::numeric FROM supplier_risk_flags WHERE status = ''active''', 'suppliers', true),
('Active Contracts', 'Currently active contracts', 'sourcing', 'custom_sql', 'SELECT COUNT(*)::numeric FROM contracts WHERE status = ''active''', 'contracts', true),
('Contracts Expiring Soon', 'Contracts expiring in next 30 days', 'sourcing', 'custom_sql', 'SELECT COUNT(*)::numeric FROM contracts WHERE end_date BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL ''30 days''', 'contracts', true);

-- Update timestamp trigger
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_dashboards_updated_at BEFORE UPDATE ON dashboards
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_kpi_definitions_updated_at BEFORE UPDATE ON kpi_definitions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_dashboard_widgets_updated_at BEFORE UPDATE ON dashboard_widgets
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();