-- Security Hardening Phase 3 + SAP Infrastructure

-- 1. Fix journal_entries - the remaining security finding
DROP POLICY IF EXISTS "Users can view journal entries" ON public.journal_entries;
DROP POLICY IF EXISTS "Finance users can view journal entries" ON public.journal_entries;

CREATE POLICY "Finance users can view journal entries"
ON public.journal_entries FOR SELECT
USING (can_access_company(company_id) AND has_finance_access(auth.uid()));

-- 2. Fix supplier_quotes - join through rfq_rfp_requests to get company
DROP POLICY IF EXISTS "Users can view supplier quotes" ON public.supplier_quotes;
DROP POLICY IF EXISTS "Procurement users can view supplier quotes" ON public.supplier_quotes;

CREATE POLICY "Procurement users can view supplier quotes"
ON public.supplier_quotes FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.rfq_rfp_requests rfq
    WHERE rfq.id = supplier_quotes.request_id
    AND can_access_company(rfq.company_id)
  )
  AND has_procurement_access(auth.uid())
);

-- SAP Integration Infrastructure Tables

-- SAP Entity Mapping Table
CREATE TABLE IF NOT EXISTS public.sap_entity_mappings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type TEXT NOT NULL,
  local_id UUID NOT NULL,
  sap_code TEXT NOT NULL,
  sap_type TEXT,
  last_synced_at TIMESTAMPTZ,
  sync_status TEXT DEFAULT 'pending',
  sync_direction TEXT DEFAULT 'bidirectional',
  company_id UUID REFERENCES public.companies(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(entity_type, local_id),
  UNIQUE(entity_type, sap_code, company_id)
);

-- SAP Sync Log
CREATE TABLE IF NOT EXISTS public.sap_sync_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type TEXT NOT NULL,
  entity_id UUID,
  sap_code TEXT,
  action TEXT NOT NULL,
  direction TEXT NOT NULL,
  status TEXT DEFAULT 'pending',
  request_payload JSONB,
  response_payload JSONB,
  error_message TEXT,
  company_id UUID REFERENCES public.companies(id),
  created_by UUID,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- SAP Configuration Table
CREATE TABLE IF NOT EXISTS public.sap_configurations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES public.companies(id) NOT NULL UNIQUE,
  sap_system_type TEXT DEFAULT 'business_one',
  is_enabled BOOLEAN DEFAULT false,
  sync_frequency TEXT DEFAULT 'manual',
  last_sync_at TIMESTAMPTZ,
  sync_settings JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS on SAP tables
ALTER TABLE public.sap_entity_mappings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sap_sync_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sap_configurations ENABLE ROW LEVEL SECURITY;

-- SAP Entity Mappings policies
CREATE POLICY "Company users can view SAP mappings"
ON public.sap_entity_mappings FOR SELECT
USING (can_access_company(company_id));

CREATE POLICY "Admins can insert SAP mappings"
ON public.sap_entity_mappings FOR INSERT
WITH CHECK (is_admin(auth.uid()) AND can_access_company(company_id));

CREATE POLICY "Admins can update SAP mappings"
ON public.sap_entity_mappings FOR UPDATE
USING (is_admin(auth.uid()) AND can_access_company(company_id));

CREATE POLICY "Admins can delete SAP mappings"
ON public.sap_entity_mappings FOR DELETE
USING (is_admin(auth.uid()) AND can_access_company(company_id));

-- SAP Sync Logs policies
CREATE POLICY "Company users can view sync logs"
ON public.sap_sync_logs FOR SELECT
USING (can_access_company(company_id));

CREATE POLICY "System can insert sync logs"
ON public.sap_sync_logs FOR INSERT
WITH CHECK (can_access_company(company_id));

-- SAP Configurations policies
CREATE POLICY "Company users can view SAP config"
ON public.sap_configurations FOR SELECT
USING (can_access_company(company_id));

CREATE POLICY "Admins can manage SAP config"
ON public.sap_configurations FOR ALL
USING (is_admin(auth.uid()) AND can_access_company(company_id));

-- Create updated_at triggers for SAP tables
CREATE TRIGGER update_sap_entity_mappings_updated_at
BEFORE UPDATE ON public.sap_entity_mappings
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_sap_configurations_updated_at
BEFORE UPDATE ON public.sap_configurations
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();