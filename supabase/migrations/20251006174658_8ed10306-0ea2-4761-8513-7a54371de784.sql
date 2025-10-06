-- Create enum types for RFQ/RFP module
CREATE TYPE rfq_rfp_type AS ENUM ('rfq', 'rfp');
CREATE TYPE rfq_rfp_status AS ENUM ('draft', 'published', 'in_progress', 'evaluation', 'awarded', 'cancelled', 'closed');
CREATE TYPE rfq_rfp_priority AS ENUM ('low', 'medium', 'high', 'urgent');
CREATE TYPE rfq_rfp_publish_type AS ENUM ('public', 'invited', 'limited');
CREATE TYPE invitation_status AS ENUM ('invited', 'viewed', 'declined', 'submitted');
CREATE TYPE quote_status AS ENUM ('draft', 'submitted', 'under_evaluation', 'shortlisted', 'awarded', 'rejected');
CREATE TYPE evaluation_recommendation AS ENUM ('strongly_recommend', 'recommend', 'neutral', 'not_recommend', 'reject');

-- Main RFQ/RFP requests table
CREATE TABLE rfq_rfp_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_number TEXT NOT NULL UNIQUE,
  request_type rfq_rfp_type NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  category TEXT,
  status rfq_rfp_status NOT NULL DEFAULT 'draft',
  priority rfq_rfp_priority NOT NULL DEFAULT 'medium',
  pr_id UUID REFERENCES purchase_requisitions(id) ON DELETE SET NULL,
  bom_id UUID REFERENCES bill_of_materials(id) ON DELETE SET NULL,
  issue_date DATE NOT NULL DEFAULT CURRENT_DATE,
  submission_deadline TIMESTAMP WITH TIME ZONE NOT NULL,
  evaluation_deadline DATE,
  budget_estimate NUMERIC(15,2),
  currency TEXT DEFAULT 'LKR',
  evaluation_criteria JSONB DEFAULT '{}',
  terms_and_conditions TEXT,
  technical_specifications TEXT,
  delivery_requirements TEXT,
  payment_terms TEXT,
  warranty_requirements TEXT,
  compliance_requirements TEXT,
  publish_type rfq_rfp_publish_type NOT NULL DEFAULT 'invited',
  created_by UUID REFERENCES auth.users(id),
  approved_by UUID REFERENCES auth.users(id),
  approved_date TIMESTAMP WITH TIME ZONE,
  awarded_supplier_id UUID REFERENCES suppliers(id),
  awarded_date TIMESTAMP WITH TIME ZONE,
  company_id UUID REFERENCES companies(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- RFQ/RFP line items
CREATE TABLE rfq_rfp_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id UUID NOT NULL REFERENCES rfq_rfp_requests(id) ON DELETE CASCADE,
  line_number INTEGER NOT NULL,
  warehouse_item_id UUID REFERENCES warehouse_items(id),
  item_code TEXT,
  item_name TEXT NOT NULL,
  description TEXT,
  specifications TEXT,
  quantity NUMERIC(15,2) NOT NULL,
  unit_of_measure TEXT NOT NULL DEFAULT 'pcs',
  estimated_unit_price NUMERIC(15,2),
  estimated_total_price NUMERIC(15,2),
  delivery_date DATE,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Invited suppliers tracking
CREATE TABLE rfq_rfp_invited_suppliers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id UUID NOT NULL REFERENCES rfq_rfp_requests(id) ON DELETE CASCADE,
  supplier_id UUID NOT NULL REFERENCES suppliers(id) ON DELETE CASCADE,
  invitation_date TIMESTAMP WITH TIME ZONE DEFAULT now(),
  invitation_status invitation_status NOT NULL DEFAULT 'invited',
  invitation_notes TEXT,
  viewed_at TIMESTAMP WITH TIME ZONE,
  declined_reason TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(request_id, supplier_id)
);

-- Supplier quotes/responses
CREATE TABLE supplier_quotes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id UUID NOT NULL REFERENCES rfq_rfp_requests(id) ON DELETE CASCADE,
  supplier_id UUID NOT NULL REFERENCES suppliers(id) ON DELETE CASCADE,
  quote_number TEXT NOT NULL UNIQUE,
  submission_date TIMESTAMP WITH TIME ZONE DEFAULT now(),
  status quote_status NOT NULL DEFAULT 'draft',
  validity_period INTEGER DEFAULT 30,
  total_quoted_amount NUMERIC(15,2) DEFAULT 0,
  currency TEXT DEFAULT 'LKR',
  payment_terms TEXT,
  delivery_commitment TEXT,
  warranty_offered TEXT,
  notes TEXT,
  attachments JSONB DEFAULT '[]',
  evaluation_score NUMERIC(5,2),
  evaluation_notes TEXT,
  evaluated_by UUID REFERENCES auth.users(id),
  evaluated_at TIMESTAMP WITH TIME ZONE,
  rejection_reason TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Supplier quote line items
CREATE TABLE supplier_quote_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quote_id UUID NOT NULL REFERENCES supplier_quotes(id) ON DELETE CASCADE,
  rfq_item_id UUID NOT NULL REFERENCES rfq_rfp_items(id) ON DELETE CASCADE,
  line_number INTEGER NOT NULL,
  unit_price NUMERIC(15,2) NOT NULL,
  total_price NUMERIC(15,2) NOT NULL,
  delivery_days INTEGER,
  alternative_offered BOOLEAN DEFAULT false,
  alternative_description TEXT,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Quote evaluations
CREATE TABLE quote_evaluations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quote_id UUID NOT NULL REFERENCES supplier_quotes(id) ON DELETE CASCADE,
  evaluator_id UUID NOT NULL REFERENCES auth.users(id),
  evaluation_date TIMESTAMP WITH TIME ZONE DEFAULT now(),
  criteria_scores JSONB DEFAULT '{}',
  technical_score NUMERIC(5,2),
  commercial_score NUMERIC(5,2),
  compliance_score NUMERIC(5,2),
  overall_score NUMERIC(5,2),
  strengths TEXT,
  weaknesses TEXT,
  recommendation evaluation_recommendation,
  comments TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Quote comparisons
CREATE TABLE quote_comparisons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id UUID NOT NULL REFERENCES rfq_rfp_requests(id) ON DELETE CASCADE,
  comparison_data JSONB DEFAULT '{}',
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Function to generate RFQ number
CREATE OR REPLACE FUNCTION generate_rfq_number()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  next_number INTEGER;
  new_rfq_number TEXT;
BEGIN
  SELECT COALESCE(MAX(CAST(SUBSTRING(request_number FROM 'RFQ-' || TO_CHAR(CURRENT_DATE, 'YYYYMMDD') || '-(.*)') AS INTEGER)), 0) + 1
  INTO next_number
  FROM rfq_rfp_requests
  WHERE request_type = 'rfq' AND request_number LIKE 'RFQ-' || TO_CHAR(CURRENT_DATE, 'YYYYMMDD') || '-%';
  
  new_rfq_number := 'RFQ-' || TO_CHAR(CURRENT_DATE, 'YYYYMMDD') || '-' || LPAD(next_number::TEXT, 3, '0');
  RETURN new_rfq_number;
END;
$$;

-- Function to generate RFP number
CREATE OR REPLACE FUNCTION generate_rfp_number()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  next_number INTEGER;
  new_rfp_number TEXT;
BEGIN
  SELECT COALESCE(MAX(CAST(SUBSTRING(request_number FROM 'RFP-' || TO_CHAR(CURRENT_DATE, 'YYYYMMDD') || '-(.*)') AS INTEGER)), 0) + 1
  INTO next_number
  FROM rfq_rfp_requests
  WHERE request_type = 'rfp' AND request_number LIKE 'RFP-' || TO_CHAR(CURRENT_DATE, 'YYYYMMDD') || '-%';
  
  new_rfp_number := 'RFP-' || TO_CHAR(CURRENT_DATE, 'YYYYMMDD') || '-' || LPAD(next_number::TEXT, 3, '0');
  RETURN new_rfp_number;
END;
$$;

-- Function to generate quote number
CREATE OR REPLACE FUNCTION generate_quote_number()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  next_number INTEGER;
  new_quote_number TEXT;
BEGIN
  SELECT COALESCE(MAX(CAST(SUBSTRING(quote_number FROM 'QT-' || TO_CHAR(CURRENT_DATE, 'YYYYMMDD') || '-(.*)') AS INTEGER)), 0) + 1
  INTO next_number
  FROM supplier_quotes
  WHERE quote_number LIKE 'QT-' || TO_CHAR(CURRENT_DATE, 'YYYYMMDD') || '-%';
  
  new_quote_number := 'QT-' || TO_CHAR(CURRENT_DATE, 'YYYYMMDD') || '-' || LPAD(next_number::TEXT, 3, '0');
  RETURN new_quote_number;
END;
$$;

-- Trigger to auto-generate RFQ/RFP number
CREATE OR REPLACE FUNCTION auto_generate_rfq_rfp_number()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.request_number IS NULL OR NEW.request_number = '' THEN
    IF NEW.request_type = 'rfq' THEN
      NEW.request_number := generate_rfq_number();
    ELSE
      NEW.request_number := generate_rfp_number();
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trigger_auto_generate_rfq_rfp_number
BEFORE INSERT ON rfq_rfp_requests
FOR EACH ROW
EXECUTE FUNCTION auto_generate_rfq_rfp_number();

-- Trigger to auto-generate quote number
CREATE OR REPLACE FUNCTION auto_generate_quote_number()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.quote_number IS NULL OR NEW.quote_number = '' THEN
    NEW.quote_number := generate_quote_number();
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trigger_auto_generate_quote_number
BEFORE INSERT ON supplier_quotes
FOR EACH ROW
EXECUTE FUNCTION auto_generate_quote_number();

-- Trigger to update quote total
CREATE OR REPLACE FUNCTION update_quote_total()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  quote_total NUMERIC(15,2);
BEGIN
  SELECT COALESCE(SUM(total_price), 0)
  INTO quote_total
  FROM supplier_quote_items
  WHERE quote_id = COALESCE(NEW.quote_id, OLD.quote_id);
  
  UPDATE supplier_quotes
  SET total_quoted_amount = quote_total,
      updated_at = now()
  WHERE id = COALESCE(NEW.quote_id, OLD.quote_id);
  
  RETURN COALESCE(NEW, OLD);
END;
$$;

CREATE TRIGGER trigger_update_quote_total
AFTER INSERT OR UPDATE OR DELETE ON supplier_quote_items
FOR EACH ROW
EXECUTE FUNCTION update_quote_total();

-- Trigger to update updated_at timestamp
CREATE TRIGGER trigger_update_rfq_rfp_updated_at
BEFORE UPDATE ON rfq_rfp_requests
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trigger_update_supplier_quotes_updated_at
BEFORE UPDATE ON supplier_quotes
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- Enable RLS
ALTER TABLE rfq_rfp_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE rfq_rfp_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE rfq_rfp_invited_suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE supplier_quotes ENABLE ROW LEVEL SECURITY;
ALTER TABLE supplier_quote_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE quote_evaluations ENABLE ROW LEVEL SECURITY;
ALTER TABLE quote_comparisons ENABLE ROW LEVEL SECURITY;

-- RLS Policies for rfq_rfp_requests
CREATE POLICY "Authenticated users can view RFQ/RFP requests"
ON rfq_rfp_requests FOR SELECT
USING (auth.uid() IS NOT NULL);

CREATE POLICY "Users can create RFQ/RFP requests"
ON rfq_rfp_requests FOR INSERT
WITH CHECK (auth.uid() IS NOT NULL AND auth.uid() = created_by);

CREATE POLICY "Users can update their own draft requests or admins can update any"
ON rfq_rfp_requests FOR UPDATE
USING ((auth.uid() = created_by AND status = 'draft') OR is_admin(auth.uid()));

CREATE POLICY "Admins can delete RFQ/RFP requests"
ON rfq_rfp_requests FOR DELETE
USING (is_admin(auth.uid()));

-- RLS Policies for rfq_rfp_items
CREATE POLICY "Users can view RFQ/RFP items they have access to"
ON rfq_rfp_items FOR SELECT
USING (EXISTS (
  SELECT 1 FROM rfq_rfp_requests r
  WHERE r.id = rfq_rfp_items.request_id
));

CREATE POLICY "Users can manage items for their own requests"
ON rfq_rfp_items FOR ALL
USING (EXISTS (
  SELECT 1 FROM rfq_rfp_requests r
  WHERE r.id = rfq_rfp_items.request_id
  AND ((r.created_by = auth.uid() AND r.status = 'draft') OR is_admin(auth.uid()))
));

-- RLS Policies for rfq_rfp_invited_suppliers
CREATE POLICY "Users can view invitations for requests they have access to"
ON rfq_rfp_invited_suppliers FOR SELECT
USING (EXISTS (
  SELECT 1 FROM rfq_rfp_requests r
  WHERE r.id = rfq_rfp_invited_suppliers.request_id
));

CREATE POLICY "Users can manage invitations for their own requests"
ON rfq_rfp_invited_suppliers FOR ALL
USING (EXISTS (
  SELECT 1 FROM rfq_rfp_requests r
  WHERE r.id = rfq_rfp_invited_suppliers.request_id
  AND ((r.created_by = auth.uid()) OR is_admin(auth.uid()))
));

-- RLS Policies for supplier_quotes
CREATE POLICY "Authenticated users can view quotes"
ON supplier_quotes FOR SELECT
USING (auth.uid() IS NOT NULL);

CREATE POLICY "Users can create quotes"
ON supplier_quotes FOR INSERT
WITH CHECK (auth.uid() IS NOT NULL AND auth.uid() = created_by);

CREATE POLICY "Users can update their own draft quotes or admins can update any"
ON supplier_quotes FOR UPDATE
USING ((auth.uid() = created_by AND status = 'draft') OR is_admin(auth.uid()));

CREATE POLICY "Admins can delete quotes"
ON supplier_quotes FOR DELETE
USING (is_admin(auth.uid()));

-- RLS Policies for supplier_quote_items
CREATE POLICY "Users can view quote items they have access to"
ON supplier_quote_items FOR SELECT
USING (EXISTS (
  SELECT 1 FROM supplier_quotes q
  WHERE q.id = supplier_quote_items.quote_id
));

CREATE POLICY "Users can manage items for their own quotes"
ON supplier_quote_items FOR ALL
USING (EXISTS (
  SELECT 1 FROM supplier_quotes q
  WHERE q.id = supplier_quote_items.quote_id
  AND ((q.created_by = auth.uid() AND q.status = 'draft') OR is_admin(auth.uid()))
));

-- RLS Policies for quote_evaluations
CREATE POLICY "Authenticated users can view evaluations"
ON quote_evaluations FOR SELECT
USING (auth.uid() IS NOT NULL);

CREATE POLICY "Users can create evaluations"
ON quote_evaluations FOR INSERT
WITH CHECK (auth.uid() IS NOT NULL AND auth.uid() = evaluator_id);

CREATE POLICY "Users can update their own evaluations"
ON quote_evaluations FOR UPDATE
USING (auth.uid() = evaluator_id);

-- RLS Policies for quote_comparisons
CREATE POLICY "Authenticated users can view comparisons"
ON quote_comparisons FOR SELECT
USING (auth.uid() IS NOT NULL);

CREATE POLICY "Users can create comparisons"
ON quote_comparisons FOR INSERT
WITH CHECK (auth.uid() IS NOT NULL AND auth.uid() = created_by);

-- Create indexes for performance
CREATE INDEX idx_rfq_rfp_requests_company ON rfq_rfp_requests(company_id);
CREATE INDEX idx_rfq_rfp_requests_status ON rfq_rfp_requests(status);
CREATE INDEX idx_rfq_rfp_requests_created_by ON rfq_rfp_requests(created_by);
CREATE INDEX idx_rfq_rfp_items_request ON rfq_rfp_items(request_id);
CREATE INDEX idx_supplier_quotes_request ON supplier_quotes(request_id);
CREATE INDEX idx_supplier_quotes_supplier ON supplier_quotes(supplier_id);
CREATE INDEX idx_supplier_quote_items_quote ON supplier_quote_items(quote_id);