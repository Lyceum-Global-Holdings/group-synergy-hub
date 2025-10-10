-- Create enums for contract management
CREATE TYPE contract_type AS ENUM (
  'supplier_contract', 'customer_contract', 'service_agreement',
  'employment_contract', 'nda', 'lease_agreement',
  'partnership_agreement', 'framework_agreement',
  'software_license', 'consulting_agreement', 'other'
);

CREATE TYPE contract_status AS ENUM (
  'draft', 'pending_approval', 'approved', 'active',
  'suspended', 'expired', 'terminated', 'renewed', 'closed'
);

CREATE TYPE contract_priority AS ENUM ('low', 'medium', 'high', 'critical');

CREATE TYPE contract_risk_level AS ENUM ('low', 'medium', 'high', 'critical');

CREATE TYPE contract_party_type AS ENUM ('internal', 'external', 'supplier', 'customer', 'partner', 'guarantor');

CREATE TYPE contract_document_type AS ENUM (
  'main_contract', 'amendment', 'annex', 'supporting_document',
  'signed_copy', 'scan', 'certificate', 'insurance',
  'compliance_document', 'correspondence', 'other'
);

CREATE TYPE signature_method AS ENUM ('physical', 'electronic', 'esign_platform');

CREATE TYPE signature_status AS ENUM ('unsigned', 'pending', 'partially_signed', 'fully_signed');

CREATE TYPE billing_frequency AS ENUM ('one_time', 'monthly', 'quarterly', 'annually', 'milestone_based');

CREATE TYPE renewal_type AS ENUM ('auto_renewal', 'manual_review', 'renegotiation_required');

CREATE TYPE confidentiality_level AS ENUM ('public', 'internal', 'confidential', 'highly_confidential');

CREATE TYPE contract_amendment_type AS ENUM (
  'price_change', 'term_extension', 'scope_change',
  'party_change', 'termination_clause', 'value_adjustment',
  'obligation_change', 'payment_terms_change', 'other'
);

CREATE TYPE obligation_type AS ENUM (
  'deliverable', 'milestone', 'payment', 'service_level',
  'compliance_requirement', 'reporting', 'renewal_action', 'inspection'
);

CREATE TYPE obligation_status AS ENUM ('pending', 'in_progress', 'completed', 'overdue', 'waived', 'disputed');

-- Create contracts table (main table)
CREATE TABLE public.contracts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  contract_number TEXT NOT NULL UNIQUE,
  contract_title TEXT NOT NULL,
  contract_type contract_type NOT NULL,
  contract_category TEXT,
  contract_sub_type TEXT,
  status contract_status NOT NULL DEFAULT 'draft',
  priority contract_priority NOT NULL DEFAULT 'medium',
  
  -- Financial Details
  contract_value NUMERIC(15,2),
  currency TEXT DEFAULT 'LKR',
  payment_terms TEXT,
  billing_frequency billing_frequency,
  
  -- Dates
  contract_date DATE NOT NULL DEFAULT CURRENT_DATE,
  effective_date DATE NOT NULL,
  expiry_date DATE,
  notice_period_days INTEGER,
  renewal_notice_days INTEGER DEFAULT 30,
  
  -- Renewal Settings
  auto_renew BOOLEAN DEFAULT false,
  renewal_type renewal_type,
  renewal_terms TEXT,
  max_renewal_count INTEGER,
  renewal_count INTEGER DEFAULT 0,
  
  -- Parties
  primary_party_type TEXT,
  primary_party_id UUID,
  counterparty_name TEXT,
  counterparty_contact TEXT,
  counterparty_email TEXT,
  
  -- Governance
  owner_id UUID,
  department_id UUID,
  cost_center_id UUID REFERENCES public.cost_centers(id),
  approval_workflow_required BOOLEAN DEFAULT true,
  approved_by UUID,
  approved_date TIMESTAMPTZ,
  
  -- Terms & Conditions
  contract_terms TEXT,
  special_conditions TEXT,
  penalty_clauses JSONB,
  termination_terms TEXT,
  dispute_resolution TEXT,
  governing_law TEXT,
  
  -- Risk & Compliance
  risk_level contract_risk_level DEFAULT 'low',
  compliance_requirements JSONB,
  insurance_required BOOLEAN DEFAULT false,
  insurance_details TEXT,
  confidentiality_level confidentiality_level DEFAULT 'internal',
  
  -- Metadata
  company_id UUID,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  signed_by_us UUID,
  signed_by_them TEXT,
  signed_date DATE,
  notes TEXT,
  tags JSONB DEFAULT '[]'::jsonb
);

-- Create contract_parties table
CREATE TABLE public.contract_parties (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  contract_id UUID NOT NULL REFERENCES public.contracts(id) ON DELETE CASCADE,
  party_type contract_party_type NOT NULL,
  party_role TEXT,
  party_reference_type TEXT,
  party_reference_id UUID,
  party_name TEXT NOT NULL,
  party_contact_person TEXT,
  party_email TEXT,
  party_phone TEXT,
  signing_authority TEXT,
  signed BOOLEAN DEFAULT false,
  signed_date DATE,
  signature_method signature_method,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create contract_documents table
CREATE TABLE public.contract_documents (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  contract_id UUID NOT NULL REFERENCES public.contracts(id) ON DELETE CASCADE,
  document_type contract_document_type NOT NULL,
  document_name TEXT NOT NULL,
  file_path TEXT NOT NULL,
  file_url TEXT,
  file_size BIGINT,
  mime_type TEXT,
  version_number TEXT DEFAULT '1.0',
  is_latest_version BOOLEAN DEFAULT true,
  document_date DATE,
  uploaded_by UUID,
  uploaded_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  description TEXT,
  is_signed BOOLEAN DEFAULT false,
  signature_status signature_status DEFAULT 'unsigned',
  esign_platform TEXT,
  esign_reference_id TEXT,
  notes TEXT
);

-- Create contract_amendments table
CREATE TABLE public.contract_amendments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  contract_id UUID NOT NULL REFERENCES public.contracts(id) ON DELETE CASCADE,
  amendment_number TEXT NOT NULL,
  amendment_date DATE NOT NULL DEFAULT CURRENT_DATE,
  amendment_type contract_amendment_type NOT NULL,
  previous_value JSONB,
  new_value JSONB,
  reason TEXT NOT NULL,
  financial_impact NUMERIC(15,2),
  approved_by UUID,
  approved_date TIMESTAMPTZ,
  effective_date DATE,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  notes TEXT,
  document_id UUID REFERENCES public.contract_documents(id)
);

-- Create contract_obligations table
CREATE TABLE public.contract_obligations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  contract_id UUID NOT NULL REFERENCES public.contracts(id) ON DELETE CASCADE,
  obligation_type obligation_type NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  responsible_party TEXT,
  assigned_to UUID,
  due_date DATE,
  completed BOOLEAN DEFAULT false,
  completed_date DATE,
  completed_by UUID,
  status obligation_status DEFAULT 'pending',
  priority contract_priority DEFAULT 'medium',
  value_amount NUMERIC(15,2),
  currency TEXT DEFAULT 'LKR',
  penalty_for_delay NUMERIC(15,2),
  evidence_required BOOLEAN DEFAULT false,
  evidence_notes TEXT,
  recurrence TEXT,
  next_occurrence_date DATE,
  notification_days_before INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create indexes for better query performance
CREATE INDEX idx_contracts_status ON public.contracts(status);
CREATE INDEX idx_contracts_expiry_date ON public.contracts(expiry_date);
CREATE INDEX idx_contracts_company_id ON public.contracts(company_id);
CREATE INDEX idx_contracts_owner_id ON public.contracts(owner_id);
CREATE INDEX idx_contracts_created_by ON public.contracts(created_by);
CREATE INDEX idx_contract_parties_contract_id ON public.contract_parties(contract_id);
CREATE INDEX idx_contract_documents_contract_id ON public.contract_documents(contract_id);
CREATE INDEX idx_contract_amendments_contract_id ON public.contract_amendments(contract_id);
CREATE INDEX idx_contract_obligations_contract_id ON public.contract_obligations(contract_id);
CREATE INDEX idx_contract_obligations_due_date ON public.contract_obligations(due_date);

-- Function to generate contract number
CREATE OR REPLACE FUNCTION public.generate_contract_number()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  next_number INTEGER;
  new_contract_number TEXT;
BEGIN
  SELECT COALESCE(MAX(CAST(SUBSTRING(contract_number FROM 'CNT-' || TO_CHAR(CURRENT_DATE, 'YYYYMMDD') || '-(.*)') AS INTEGER)), 0) + 1
  INTO next_number
  FROM contracts
  WHERE contract_number LIKE 'CNT-' || TO_CHAR(CURRENT_DATE, 'YYYYMMDD') || '-%';
  
  new_contract_number := 'CNT-' || TO_CHAR(CURRENT_DATE, 'YYYYMMDD') || '-' || LPAD(next_number::TEXT, 3, '0');
  RETURN new_contract_number;
END;
$$;

-- Trigger function for auto-generating contract number
CREATE OR REPLACE FUNCTION public.auto_generate_contract_number()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.contract_number IS NULL OR NEW.contract_number = '' THEN
    NEW.contract_number := generate_contract_number();
  END IF;
  RETURN NEW;
END;
$$;

-- Trigger to auto-generate contract number
CREATE TRIGGER auto_generate_contract_number
BEFORE INSERT ON public.contracts
FOR EACH ROW
EXECUTE FUNCTION public.auto_generate_contract_number();

-- Enable Row Level Security
ALTER TABLE public.contracts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contract_parties ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contract_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contract_amendments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contract_obligations ENABLE ROW LEVEL SECURITY;

-- RLS Policies for contracts table
CREATE POLICY "Admins can manage all contracts"
ON public.contracts FOR ALL
USING (is_admin(auth.uid()));

CREATE POLICY "Users can view contracts they created or own"
ON public.contracts FOR SELECT
USING (
  auth.uid() IS NOT NULL 
  AND (
    created_by = auth.uid() 
    OR owner_id = auth.uid()
    OR is_admin(auth.uid())
  )
);

CREATE POLICY "Users can create contracts"
ON public.contracts FOR INSERT
WITH CHECK (
  auth.uid() IS NOT NULL 
  AND created_by = auth.uid()
);

CREATE POLICY "Users can update their own contracts"
ON public.contracts FOR UPDATE
USING (
  created_by = auth.uid() 
  OR owner_id = auth.uid()
  OR is_admin(auth.uid())
);

-- RLS Policies for contract_parties
CREATE POLICY "Users can view parties for accessible contracts"
ON public.contract_parties FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.contracts
    WHERE contracts.id = contract_parties.contract_id
    AND (contracts.created_by = auth.uid() OR contracts.owner_id = auth.uid() OR is_admin(auth.uid()))
  )
);

CREATE POLICY "Users can manage parties for their contracts"
ON public.contract_parties FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.contracts
    WHERE contracts.id = contract_parties.contract_id
    AND (contracts.created_by = auth.uid() OR contracts.owner_id = auth.uid() OR is_admin(auth.uid()))
  )
);

-- RLS Policies for contract_documents
CREATE POLICY "Users can view documents for accessible contracts"
ON public.contract_documents FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.contracts
    WHERE contracts.id = contract_documents.contract_id
    AND (contracts.created_by = auth.uid() OR contracts.owner_id = auth.uid() OR is_admin(auth.uid()))
  )
);

CREATE POLICY "Users can manage documents for their contracts"
ON public.contract_documents FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.contracts
    WHERE contracts.id = contract_documents.contract_id
    AND (contracts.created_by = auth.uid() OR contracts.owner_id = auth.uid() OR is_admin(auth.uid()))
  )
);

-- RLS Policies for contract_amendments
CREATE POLICY "Users can view amendments for accessible contracts"
ON public.contract_amendments FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.contracts
    WHERE contracts.id = contract_amendments.contract_id
    AND (contracts.created_by = auth.uid() OR contracts.owner_id = auth.uid() OR is_admin(auth.uid()))
  )
);

CREATE POLICY "Users can manage amendments for their contracts"
ON public.contract_amendments FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.contracts
    WHERE contracts.id = contract_amendments.contract_id
    AND (contracts.created_by = auth.uid() OR contracts.owner_id = auth.uid() OR is_admin(auth.uid()))
  )
);

-- RLS Policies for contract_obligations
CREATE POLICY "Users can view obligations for accessible contracts"
ON public.contract_obligations FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.contracts
    WHERE contracts.id = contract_obligations.contract_id
    AND (contracts.created_by = auth.uid() OR contracts.owner_id = auth.uid() OR is_admin(auth.uid()))
  )
);

CREATE POLICY "Users can manage obligations for their contracts"
ON public.contract_obligations FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.contracts
    WHERE contracts.id = contract_obligations.contract_id
    AND (contracts.created_by = auth.uid() OR contracts.owner_id = auth.uid() OR is_admin(auth.uid()))
  )
);