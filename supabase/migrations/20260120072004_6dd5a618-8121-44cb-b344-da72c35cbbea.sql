-- Add new columns to construction_labour_master
ALTER TABLE construction_labour_master 
ADD COLUMN IF NOT EXISTS epf_no TEXT,
ADD COLUMN IF NOT EXISTS employee_id TEXT UNIQUE,
ADD COLUMN IF NOT EXISTS category TEXT,
ADD COLUMN IF NOT EXISTS labour_company TEXT;

-- Create table for labour categories (dynamic dropdown)
CREATE TABLE IF NOT EXISTS construction_labour_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  is_default BOOLEAN DEFAULT false,
  created_by UUID,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  UNIQUE(company_id, name)
);

-- Create table for labour companies (dynamic dropdown, different from system companies)
CREATE TABLE IF NOT EXISTS construction_labour_companies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  is_default BOOLEAN DEFAULT false,
  created_by UUID,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  UNIQUE(company_id, name)
);

-- Enable RLS
ALTER TABLE construction_labour_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE construction_labour_companies ENABLE ROW LEVEL SECURITY;

-- RLS policies for labour categories
CREATE POLICY "Users can view labour categories for their company"
ON construction_labour_categories FOR SELECT
USING (company_id IS NULL OR company_id IN (
  SELECT id FROM companies WHERE id IN (
    SELECT company_id FROM profiles WHERE id = auth.uid()
  )
) OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('super_admin', 'admin')));

CREATE POLICY "Users can insert labour categories"
ON construction_labour_categories FOR INSERT
WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Users can update labour categories"
ON construction_labour_categories FOR UPDATE
USING (auth.uid() IS NOT NULL);

CREATE POLICY "Users can delete labour categories"
ON construction_labour_categories FOR DELETE
USING (auth.uid() IS NOT NULL);

-- RLS policies for labour companies
CREATE POLICY "Users can view labour companies for their company"
ON construction_labour_companies FOR SELECT
USING (company_id IS NULL OR company_id IN (
  SELECT id FROM companies WHERE id IN (
    SELECT company_id FROM profiles WHERE id = auth.uid()
  )
) OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('super_admin', 'admin')));

CREATE POLICY "Users can insert labour companies"
ON construction_labour_companies FOR INSERT
WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Users can update labour companies"
ON construction_labour_companies FOR UPDATE
USING (auth.uid() IS NOT NULL);

CREATE POLICY "Users can delete labour companies"
ON construction_labour_companies FOR DELETE
USING (auth.uid() IS NOT NULL);

-- Insert default categories
INSERT INTO construction_labour_categories (name, is_default, company_id) VALUES
('Civil Skill', true, NULL),
('Civil Labour (Unskill)', true, NULL),
('MEP', true, NULL),
('Aluminium', true, NULL),
('Officer', true, NULL)
ON CONFLICT DO NOTHING;

-- Insert default labour companies
INSERT INTO construction_labour_companies (name, is_default, company_id) VALUES
('VEB', true, NULL),
('NWS', true, NULL)
ON CONFLICT DO NOTHING;

-- Create function to auto-generate employee ID
CREATE OR REPLACE FUNCTION generate_labour_employee_id()
RETURNS TRIGGER AS $$
DECLARE
  new_seq INTEGER;
  prefix TEXT := 'EMP';
BEGIN
  -- Get next sequence number
  SELECT COALESCE(MAX(CAST(SUBSTRING(employee_id FROM 4) AS INTEGER)), 0) + 1
  INTO new_seq
  FROM construction_labour_master
  WHERE employee_id LIKE 'EMP%';
  
  -- Generate employee ID
  NEW.employee_id := prefix || LPAD(new_seq::TEXT, 5, '0');
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for auto-generating employee ID
DROP TRIGGER IF EXISTS trigger_generate_labour_employee_id ON construction_labour_master;
CREATE TRIGGER trigger_generate_labour_employee_id
BEFORE INSERT ON construction_labour_master
FOR EACH ROW
WHEN (NEW.employee_id IS NULL)
EXECUTE FUNCTION generate_labour_employee_id();