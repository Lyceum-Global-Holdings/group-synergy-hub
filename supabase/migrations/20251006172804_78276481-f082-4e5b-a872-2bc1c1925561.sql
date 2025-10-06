-- Create supplier registration requests table
CREATE TABLE supplier_registration_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_type TEXT NOT NULL DEFAULT 'internal',
  status TEXT NOT NULL DEFAULT 'draft',
  supplier_data JSONB NOT NULL,
  documents JSONB DEFAULT '[]'::jsonb,
  submitted_by UUID REFERENCES auth.users(id),
  submitted_at TIMESTAMPTZ,
  reviewed_by UUID REFERENCES auth.users(id),
  reviewed_at TIMESTAMPTZ,
  rejection_reason TEXT,
  company_id UUID REFERENCES companies(id),
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create supplier documents table
CREATE TABLE supplier_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_id UUID REFERENCES suppliers(id) ON DELETE CASCADE,
  registration_request_id UUID REFERENCES supplier_registration_requests(id) ON DELETE CASCADE,
  document_type TEXT NOT NULL,
  file_name TEXT NOT NULL,
  file_url TEXT NOT NULL,
  file_size BIGINT,
  uploaded_by UUID REFERENCES auth.users(id),
  verified_by UUID REFERENCES auth.users(id),
  verified_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create supplier approval workflow table
CREATE TABLE supplier_approval_workflow (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  registration_request_id UUID NOT NULL REFERENCES supplier_registration_requests(id) ON DELETE CASCADE,
  stage TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  assigned_to UUID REFERENCES auth.users(id),
  completed_by UUID REFERENCES auth.users(id),
  completed_at TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE supplier_registration_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE supplier_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE supplier_approval_workflow ENABLE ROW LEVEL SECURITY;

-- RLS Policies for supplier_registration_requests
CREATE POLICY "Authenticated users can view registration requests"
ON supplier_registration_requests FOR SELECT
TO authenticated
USING (auth.uid() IS NOT NULL);

CREATE POLICY "Users can create registration requests"
ON supplier_registration_requests FOR INSERT
TO authenticated
WITH CHECK (auth.uid() IS NOT NULL AND auth.uid() = created_by);

CREATE POLICY "Users can update their own draft requests or admins can update any"
ON supplier_registration_requests FOR UPDATE
TO authenticated
USING ((auth.uid() = created_by AND status = 'draft') OR is_admin(auth.uid()));

CREATE POLICY "Admins can delete registration requests"
ON supplier_registration_requests FOR DELETE
TO authenticated
USING (is_admin(auth.uid()));

-- RLS Policies for supplier_documents
CREATE POLICY "Authenticated users can view documents"
ON supplier_documents FOR SELECT
TO authenticated
USING (auth.uid() IS NOT NULL);

CREATE POLICY "Users can upload documents"
ON supplier_documents FOR INSERT
TO authenticated
WITH CHECK (auth.uid() IS NOT NULL AND auth.uid() = uploaded_by);

CREATE POLICY "Admins can update documents"
ON supplier_documents FOR UPDATE
TO authenticated
USING (is_admin(auth.uid()));

CREATE POLICY "Admins can delete documents"
ON supplier_documents FOR DELETE
TO authenticated
USING (is_admin(auth.uid()));

-- RLS Policies for supplier_approval_workflow
CREATE POLICY "Authenticated users can view workflow"
ON supplier_approval_workflow FOR SELECT
TO authenticated
USING (auth.uid() IS NOT NULL);

CREATE POLICY "System can create workflow entries"
ON supplier_approval_workflow FOR INSERT
TO authenticated
WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Assigned users or admins can update workflow"
ON supplier_approval_workflow FOR UPDATE
TO authenticated
USING (auth.uid() = assigned_to OR is_admin(auth.uid()));

-- Create updated_at trigger
CREATE TRIGGER update_supplier_registration_requests_updated_at
  BEFORE UPDATE ON supplier_registration_requests
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Create function to check for duplicate suppliers
CREATE OR REPLACE FUNCTION check_duplicate_supplier(
  p_supplier_name TEXT,
  p_email TEXT DEFAULT NULL,
  p_phone TEXT DEFAULT NULL,
  p_tax_id TEXT DEFAULT NULL
) RETURNS TABLE(
  id UUID,
  supplier_name TEXT,
  email TEXT,
  phone TEXT,
  tax_id TEXT,
  match_reason TEXT
) 
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    s.id,
    s.supplier_name,
    s.email,
    s.phone,
    s.tax_id,
    CASE 
      WHEN s.tax_id IS NOT NULL AND s.tax_id = p_tax_id THEN 'tax_id'
      WHEN s.email IS NOT NULL AND s.email = p_email THEN 'email'
      WHEN s.phone IS NOT NULL AND s.phone = p_phone THEN 'phone'
      WHEN LOWER(s.supplier_name) = LOWER(p_supplier_name) THEN 'name'
      ELSE 'unknown'
    END as match_reason
  FROM suppliers s
  WHERE 
    (p_tax_id IS NOT NULL AND s.tax_id = p_tax_id) OR
    (p_email IS NOT NULL AND s.email = p_email) OR
    (p_phone IS NOT NULL AND s.phone = p_phone) OR
    LOWER(s.supplier_name) = LOWER(p_supplier_name)
  LIMIT 5;
END;
$$;