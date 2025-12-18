-- =====================================================
-- CONSTRUCTION SUB-MODULES DATABASE SCHEMA
-- =====================================================

-- 1. Work Orders
CREATE TABLE construction_work_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES construction_projects(id) ON DELETE CASCADE,
  company_id UUID REFERENCES companies(id),
  work_order_number TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  work_type TEXT, -- civil, electrical, plumbing, finishing, etc.
  priority TEXT DEFAULT 'medium', -- low, medium, high, urgent
  status TEXT DEFAULT 'pending', -- pending, in_progress, completed, cancelled
  assigned_to UUID,
  site_id UUID REFERENCES project_sites(id),
  planned_start_date DATE,
  planned_end_date DATE,
  actual_start_date DATE,
  actual_end_date DATE,
  estimated_hours NUMERIC(8,2),
  actual_hours NUMERIC(8,2),
  estimated_cost NUMERIC(12,2),
  actual_cost NUMERIC(12,2),
  notes TEXT,
  created_by UUID,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Daily Site Reports
CREATE TABLE daily_site_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES construction_projects(id) ON DELETE CASCADE,
  company_id UUID REFERENCES companies(id),
  report_number TEXT NOT NULL,
  report_date DATE NOT NULL,
  site_id UUID REFERENCES project_sites(id),
  weather_conditions TEXT,
  temperature_high NUMERIC(5,2),
  temperature_low NUMERIC(5,2),
  labor_count INTEGER,
  subcontractor_count INTEGER,
  visitor_count INTEGER,
  work_summary TEXT,
  delays_issues TEXT,
  materials_received TEXT,
  equipment_on_site TEXT,
  safety_observations TEXT,
  photos_url TEXT[],
  submitted_by UUID,
  approved_by UUID,
  status TEXT DEFAULT 'draft', -- draft, submitted, approved
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Site Report Activities
CREATE TABLE site_report_activities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id UUID NOT NULL REFERENCES daily_site_reports(id) ON DELETE CASCADE,
  activity_type TEXT NOT NULL,
  description TEXT,
  location TEXT,
  labor_hours NUMERIC(8,2),
  completion_percentage NUMERIC(5,2),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Construction Resources
CREATE TABLE construction_resources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES construction_projects(id) ON DELETE CASCADE,
  company_id UUID REFERENCES companies(id),
  resource_type TEXT NOT NULL, -- labor, equipment, material, subcontractor
  resource_name TEXT NOT NULL,
  description TEXT,
  unit TEXT,
  quantity_allocated NUMERIC(12,3),
  quantity_used NUMERIC(12,3) DEFAULT 0,
  unit_cost NUMERIC(12,2),
  total_cost NUMERIC(12,2),
  start_date DATE,
  end_date DATE,
  status TEXT DEFAULT 'planned', -- planned, active, completed, released
  assigned_site_id UUID REFERENCES project_sites(id),
  notes TEXT,
  created_by UUID,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. Quality Inspections
CREATE TABLE quality_inspections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES construction_projects(id) ON DELETE CASCADE,
  company_id UUID REFERENCES companies(id),
  inspection_number TEXT NOT NULL,
  inspection_type TEXT NOT NULL, -- structural, electrical, plumbing, finishing, safety
  title TEXT NOT NULL,
  description TEXT,
  site_id UUID REFERENCES project_sites(id),
  work_order_id UUID REFERENCES construction_work_orders(id),
  inspection_date DATE NOT NULL,
  inspector_id UUID,
  status TEXT DEFAULT 'scheduled', -- scheduled, in_progress, completed, failed
  overall_result TEXT, -- pass, fail, conditional_pass
  findings TEXT,
  corrective_actions TEXT,
  follow_up_date DATE,
  photos_url TEXT[],
  created_by UUID,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. Quality Inspection Items
CREATE TABLE quality_inspection_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  inspection_id UUID NOT NULL REFERENCES quality_inspections(id) ON DELETE CASCADE,
  item_order INTEGER,
  checklist_item TEXT NOT NULL,
  requirement TEXT,
  result TEXT, -- pass, fail, na
  measured_value TEXT,
  expected_value TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 7. Safety Incidents
CREATE TABLE safety_incidents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES construction_projects(id) ON DELETE CASCADE,
  company_id UUID REFERENCES companies(id),
  incident_number TEXT NOT NULL,
  incident_type TEXT NOT NULL, -- near_miss, first_aid, medical, lost_time, fatality
  severity TEXT DEFAULT 'low', -- low, medium, high, critical
  title TEXT NOT NULL,
  description TEXT,
  site_id UUID REFERENCES project_sites(id),
  incident_date DATE NOT NULL,
  incident_time TIME,
  location TEXT,
  injured_party TEXT,
  injury_description TEXT,
  immediate_actions TEXT,
  root_cause TEXT,
  corrective_actions TEXT,
  preventive_actions TEXT,
  reported_by UUID,
  investigated_by UUID,
  status TEXT DEFAULT 'reported', -- reported, investigating, closed
  photos_url TEXT[],
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 8. Safety Inspections
CREATE TABLE safety_inspections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES construction_projects(id) ON DELETE CASCADE,
  company_id UUID REFERENCES companies(id),
  inspection_number TEXT NOT NULL,
  inspection_type TEXT NOT NULL, -- daily, weekly, monthly, special
  site_id UUID REFERENCES project_sites(id),
  inspection_date DATE NOT NULL,
  inspector_id UUID,
  status TEXT DEFAULT 'scheduled', -- scheduled, completed
  overall_score NUMERIC(5,2),
  findings TEXT,
  hazards_identified TEXT,
  corrective_actions TEXT,
  follow_up_required BOOLEAN DEFAULT FALSE,
  follow_up_date DATE,
  photos_url TEXT[],
  created_by UUID,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 9. Project Documents
CREATE TABLE construction_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES construction_projects(id) ON DELETE CASCADE,
  company_id UUID REFERENCES companies(id),
  document_number TEXT NOT NULL,
  document_type TEXT NOT NULL, -- drawing, specification, permit, contract, report, photo, other
  title TEXT NOT NULL,
  description TEXT,
  file_url TEXT NOT NULL,
  file_name TEXT,
  file_size INTEGER,
  file_type TEXT,
  version TEXT DEFAULT '1.0',
  is_latest BOOLEAN DEFAULT TRUE,
  revision_notes TEXT,
  tags TEXT[],
  uploaded_by UUID,
  approved_by UUID,
  approval_date DATE,
  status TEXT DEFAULT 'draft', -- draft, pending_approval, approved, superseded
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 10. Project Budget Items
CREATE TABLE project_budget_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES construction_projects(id) ON DELETE CASCADE,
  company_id UUID REFERENCES companies(id),
  budget_code TEXT NOT NULL,
  category TEXT NOT NULL, -- labor, materials, equipment, subcontractor, overhead, contingency
  description TEXT NOT NULL,
  planned_amount NUMERIC(14,2) NOT NULL,
  committed_amount NUMERIC(14,2) DEFAULT 0,
  actual_amount NUMERIC(14,2) DEFAULT 0,
  unit TEXT,
  quantity NUMERIC(12,3),
  unit_cost NUMERIC(12,2),
  notes TEXT,
  created_by UUID,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 11. Budget Transactions
CREATE TABLE budget_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  budget_item_id UUID NOT NULL REFERENCES project_budget_items(id) ON DELETE CASCADE,
  transaction_type TEXT NOT NULL, -- commitment, actual, adjustment
  amount NUMERIC(14,2) NOT NULL,
  transaction_date DATE NOT NULL,
  reference_number TEXT,
  vendor TEXT,
  description TEXT,
  created_by UUID,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- AUTO-GENERATE NUMBER FUNCTIONS
-- =====================================================

-- Work Order Number Generator
CREATE OR REPLACE FUNCTION generate_work_order_number()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  next_number INTEGER;
  new_number TEXT;
BEGIN
  SELECT COALESCE(MAX(CAST(SUBSTRING(work_order_number FROM 'WO-' || TO_CHAR(CURRENT_DATE, 'YYYYMM') || '-(.*)') AS INTEGER)), 0) + 1
  INTO next_number
  FROM construction_work_orders
  WHERE work_order_number LIKE 'WO-' || TO_CHAR(CURRENT_DATE, 'YYYYMM') || '-%';
  
  new_number := 'WO-' || TO_CHAR(CURRENT_DATE, 'YYYYMM') || '-' || LPAD(next_number::TEXT, 4, '0');
  RETURN new_number;
END;
$$;

-- Daily Report Number Generator
CREATE OR REPLACE FUNCTION generate_daily_report_number()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  next_number INTEGER;
  new_number TEXT;
BEGIN
  SELECT COALESCE(MAX(CAST(SUBSTRING(report_number FROM 'DSR-' || TO_CHAR(CURRENT_DATE, 'YYYYMMDD') || '-(.*)') AS INTEGER)), 0) + 1
  INTO next_number
  FROM daily_site_reports
  WHERE report_number LIKE 'DSR-' || TO_CHAR(CURRENT_DATE, 'YYYYMMDD') || '-%';
  
  new_number := 'DSR-' || TO_CHAR(CURRENT_DATE, 'YYYYMMDD') || '-' || LPAD(next_number::TEXT, 3, '0');
  RETURN new_number;
END;
$$;

-- Quality Inspection Number Generator
CREATE OR REPLACE FUNCTION generate_quality_inspection_number()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  next_number INTEGER;
  new_number TEXT;
BEGIN
  SELECT COALESCE(MAX(CAST(SUBSTRING(inspection_number FROM 'QI-' || TO_CHAR(CURRENT_DATE, 'YYYYMM') || '-(.*)') AS INTEGER)), 0) + 1
  INTO next_number
  FROM quality_inspections
  WHERE inspection_number LIKE 'QI-' || TO_CHAR(CURRENT_DATE, 'YYYYMM') || '-%';
  
  new_number := 'QI-' || TO_CHAR(CURRENT_DATE, 'YYYYMM') || '-' || LPAD(next_number::TEXT, 4, '0');
  RETURN new_number;
END;
$$;

-- Safety Incident Number Generator
CREATE OR REPLACE FUNCTION generate_safety_incident_number()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  next_number INTEGER;
  new_number TEXT;
BEGIN
  SELECT COALESCE(MAX(CAST(SUBSTRING(incident_number FROM 'SI-' || TO_CHAR(CURRENT_DATE, 'YYYYMM') || '-(.*)') AS INTEGER)), 0) + 1
  INTO next_number
  FROM safety_incidents
  WHERE incident_number LIKE 'SI-' || TO_CHAR(CURRENT_DATE, 'YYYYMM') || '-%';
  
  new_number := 'SI-' || TO_CHAR(CURRENT_DATE, 'YYYYMM') || '-' || LPAD(next_number::TEXT, 4, '0');
  RETURN new_number;
END;
$$;

-- Safety Inspection Number Generator
CREATE OR REPLACE FUNCTION generate_safety_inspection_number()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  next_number INTEGER;
  new_number TEXT;
BEGIN
  SELECT COALESCE(MAX(CAST(SUBSTRING(inspection_number FROM 'SINSP-' || TO_CHAR(CURRENT_DATE, 'YYYYMM') || '-(.*)') AS INTEGER)), 0) + 1
  INTO next_number
  FROM safety_inspections
  WHERE inspection_number LIKE 'SINSP-' || TO_CHAR(CURRENT_DATE, 'YYYYMM') || '-%';
  
  new_number := 'SINSP-' || TO_CHAR(CURRENT_DATE, 'YYYYMM') || '-' || LPAD(next_number::TEXT, 4, '0');
  RETURN new_number;
END;
$$;

-- Construction Document Number Generator
CREATE OR REPLACE FUNCTION generate_construction_document_number()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  next_number INTEGER;
  new_number TEXT;
BEGIN
  SELECT COALESCE(MAX(CAST(SUBSTRING(document_number FROM 'DOC-' || TO_CHAR(CURRENT_DATE, 'YYYYMM') || '-(.*)') AS INTEGER)), 0) + 1
  INTO next_number
  FROM construction_documents
  WHERE document_number LIKE 'DOC-' || TO_CHAR(CURRENT_DATE, 'YYYYMM') || '-%';
  
  new_number := 'DOC-' || TO_CHAR(CURRENT_DATE, 'YYYYMM') || '-' || LPAD(next_number::TEXT, 4, '0');
  RETURN new_number;
END;
$$;

-- =====================================================
-- AUTO-GENERATE TRIGGERS
-- =====================================================

CREATE OR REPLACE FUNCTION auto_generate_work_order_number()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.work_order_number IS NULL OR NEW.work_order_number = '' THEN
    NEW.work_order_number := generate_work_order_number();
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_auto_work_order_number
BEFORE INSERT ON construction_work_orders
FOR EACH ROW EXECUTE FUNCTION auto_generate_work_order_number();

CREATE OR REPLACE FUNCTION auto_generate_daily_report_number()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.report_number IS NULL OR NEW.report_number = '' THEN
    NEW.report_number := generate_daily_report_number();
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_auto_daily_report_number
BEFORE INSERT ON daily_site_reports
FOR EACH ROW EXECUTE FUNCTION auto_generate_daily_report_number();

CREATE OR REPLACE FUNCTION auto_generate_quality_inspection_number()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.inspection_number IS NULL OR NEW.inspection_number = '' THEN
    NEW.inspection_number := generate_quality_inspection_number();
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_auto_quality_inspection_number
BEFORE INSERT ON quality_inspections
FOR EACH ROW EXECUTE FUNCTION auto_generate_quality_inspection_number();

CREATE OR REPLACE FUNCTION auto_generate_safety_incident_number()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.incident_number IS NULL OR NEW.incident_number = '' THEN
    NEW.incident_number := generate_safety_incident_number();
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_auto_safety_incident_number
BEFORE INSERT ON safety_incidents
FOR EACH ROW EXECUTE FUNCTION auto_generate_safety_incident_number();

CREATE OR REPLACE FUNCTION auto_generate_safety_inspection_number()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.inspection_number IS NULL OR NEW.inspection_number = '' THEN
    NEW.inspection_number := generate_safety_inspection_number();
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_auto_safety_inspection_number
BEFORE INSERT ON safety_inspections
FOR EACH ROW EXECUTE FUNCTION auto_generate_safety_inspection_number();

CREATE OR REPLACE FUNCTION auto_generate_construction_document_number()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.document_number IS NULL OR NEW.document_number = '' THEN
    NEW.document_number := generate_construction_document_number();
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_auto_construction_document_number
BEFORE INSERT ON construction_documents
FOR EACH ROW EXECUTE FUNCTION auto_generate_construction_document_number();

-- =====================================================
-- UPDATED_AT TRIGGERS
-- =====================================================

CREATE TRIGGER update_construction_work_orders_updated_at
BEFORE UPDATE ON construction_work_orders
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_daily_site_reports_updated_at
BEFORE UPDATE ON daily_site_reports
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_construction_resources_updated_at
BEFORE UPDATE ON construction_resources
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_quality_inspections_updated_at
BEFORE UPDATE ON quality_inspections
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_safety_incidents_updated_at
BEFORE UPDATE ON safety_incidents
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_safety_inspections_updated_at
BEFORE UPDATE ON safety_inspections
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_construction_documents_updated_at
BEFORE UPDATE ON construction_documents
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_project_budget_items_updated_at
BEFORE UPDATE ON project_budget_items
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- ROW LEVEL SECURITY POLICIES
-- =====================================================

-- Enable RLS on all tables
ALTER TABLE construction_work_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_site_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE site_report_activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE construction_resources ENABLE ROW LEVEL SECURITY;
ALTER TABLE quality_inspections ENABLE ROW LEVEL SECURITY;
ALTER TABLE quality_inspection_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE safety_incidents ENABLE ROW LEVEL SECURITY;
ALTER TABLE safety_inspections ENABLE ROW LEVEL SECURITY;
ALTER TABLE construction_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_budget_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE budget_transactions ENABLE ROW LEVEL SECURITY;

-- Work Orders Policies
CREATE POLICY "Users can view work orders" ON construction_work_orders
FOR SELECT TO authenticated USING (true);

CREATE POLICY "Users can create work orders" ON construction_work_orders
FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Users can update work orders" ON construction_work_orders
FOR UPDATE TO authenticated USING (true);

CREATE POLICY "Users can delete work orders" ON construction_work_orders
FOR DELETE TO authenticated USING (true);

-- Daily Site Reports Policies
CREATE POLICY "Users can view daily reports" ON daily_site_reports
FOR SELECT TO authenticated USING (true);

CREATE POLICY "Users can create daily reports" ON daily_site_reports
FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Users can update daily reports" ON daily_site_reports
FOR UPDATE TO authenticated USING (true);

CREATE POLICY "Users can delete daily reports" ON daily_site_reports
FOR DELETE TO authenticated USING (true);

-- Site Report Activities Policies
CREATE POLICY "Users can view report activities" ON site_report_activities
FOR SELECT TO authenticated USING (true);

CREATE POLICY "Users can create report activities" ON site_report_activities
FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Users can update report activities" ON site_report_activities
FOR UPDATE TO authenticated USING (true);

CREATE POLICY "Users can delete report activities" ON site_report_activities
FOR DELETE TO authenticated USING (true);

-- Construction Resources Policies
CREATE POLICY "Users can view resources" ON construction_resources
FOR SELECT TO authenticated USING (true);

CREATE POLICY "Users can create resources" ON construction_resources
FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Users can update resources" ON construction_resources
FOR UPDATE TO authenticated USING (true);

CREATE POLICY "Users can delete resources" ON construction_resources
FOR DELETE TO authenticated USING (true);

-- Quality Inspections Policies
CREATE POLICY "Users can view quality inspections" ON quality_inspections
FOR SELECT TO authenticated USING (true);

CREATE POLICY "Users can create quality inspections" ON quality_inspections
FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Users can update quality inspections" ON quality_inspections
FOR UPDATE TO authenticated USING (true);

CREATE POLICY "Users can delete quality inspections" ON quality_inspections
FOR DELETE TO authenticated USING (true);

-- Quality Inspection Items Policies
CREATE POLICY "Users can view inspection items" ON quality_inspection_items
FOR SELECT TO authenticated USING (true);

CREATE POLICY "Users can create inspection items" ON quality_inspection_items
FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Users can update inspection items" ON quality_inspection_items
FOR UPDATE TO authenticated USING (true);

CREATE POLICY "Users can delete inspection items" ON quality_inspection_items
FOR DELETE TO authenticated USING (true);

-- Safety Incidents Policies
CREATE POLICY "Users can view safety incidents" ON safety_incidents
FOR SELECT TO authenticated USING (true);

CREATE POLICY "Users can create safety incidents" ON safety_incidents
FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Users can update safety incidents" ON safety_incidents
FOR UPDATE TO authenticated USING (true);

CREATE POLICY "Users can delete safety incidents" ON safety_incidents
FOR DELETE TO authenticated USING (true);

-- Safety Inspections Policies
CREATE POLICY "Users can view safety inspections" ON safety_inspections
FOR SELECT TO authenticated USING (true);

CREATE POLICY "Users can create safety inspections" ON safety_inspections
FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Users can update safety inspections" ON safety_inspections
FOR UPDATE TO authenticated USING (true);

CREATE POLICY "Users can delete safety inspections" ON safety_inspections
FOR DELETE TO authenticated USING (true);

-- Construction Documents Policies
CREATE POLICY "Users can view construction documents" ON construction_documents
FOR SELECT TO authenticated USING (true);

CREATE POLICY "Users can create construction documents" ON construction_documents
FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Users can update construction documents" ON construction_documents
FOR UPDATE TO authenticated USING (true);

CREATE POLICY "Users can delete construction documents" ON construction_documents
FOR DELETE TO authenticated USING (true);

-- Project Budget Items Policies
CREATE POLICY "Users can view budget items" ON project_budget_items
FOR SELECT TO authenticated USING (true);

CREATE POLICY "Users can create budget items" ON project_budget_items
FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Users can update budget items" ON project_budget_items
FOR UPDATE TO authenticated USING (true);

CREATE POLICY "Users can delete budget items" ON project_budget_items
FOR DELETE TO authenticated USING (true);

-- Budget Transactions Policies
CREATE POLICY "Users can view budget transactions" ON budget_transactions
FOR SELECT TO authenticated USING (true);

CREATE POLICY "Users can create budget transactions" ON budget_transactions
FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Users can delete budget transactions" ON budget_transactions
FOR DELETE TO authenticated USING (true);

-- =====================================================
-- INDEXES FOR PERFORMANCE
-- =====================================================

CREATE INDEX idx_work_orders_project ON construction_work_orders(project_id);
CREATE INDEX idx_work_orders_status ON construction_work_orders(status);
CREATE INDEX idx_work_orders_assigned ON construction_work_orders(assigned_to);

CREATE INDEX idx_daily_reports_project ON daily_site_reports(project_id);
CREATE INDEX idx_daily_reports_date ON daily_site_reports(report_date);
CREATE INDEX idx_daily_reports_status ON daily_site_reports(status);

CREATE INDEX idx_report_activities_report ON site_report_activities(report_id);

CREATE INDEX idx_resources_project ON construction_resources(project_id);
CREATE INDEX idx_resources_type ON construction_resources(resource_type);
CREATE INDEX idx_resources_status ON construction_resources(status);

CREATE INDEX idx_quality_inspections_project ON quality_inspections(project_id);
CREATE INDEX idx_quality_inspections_date ON quality_inspections(inspection_date);
CREATE INDEX idx_quality_inspections_status ON quality_inspections(status);

CREATE INDEX idx_inspection_items_inspection ON quality_inspection_items(inspection_id);

CREATE INDEX idx_safety_incidents_project ON safety_incidents(project_id);
CREATE INDEX idx_safety_incidents_date ON safety_incidents(incident_date);
CREATE INDEX idx_safety_incidents_severity ON safety_incidents(severity);

CREATE INDEX idx_safety_inspections_project ON safety_inspections(project_id);
CREATE INDEX idx_safety_inspections_date ON safety_inspections(inspection_date);

CREATE INDEX idx_construction_documents_project ON construction_documents(project_id);
CREATE INDEX idx_construction_documents_type ON construction_documents(document_type);
CREATE INDEX idx_construction_documents_status ON construction_documents(status);

CREATE INDEX idx_budget_items_project ON project_budget_items(project_id);
CREATE INDEX idx_budget_items_category ON project_budget_items(category);

CREATE INDEX idx_budget_transactions_item ON budget_transactions(budget_item_id);
CREATE INDEX idx_budget_transactions_date ON budget_transactions(transaction_date);