-- Create approval stages configuration table
CREATE TABLE IF NOT EXISTS public.approval_stages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE,
  stage_order INTEGER NOT NULL,
  stage_name VARCHAR(100) NOT NULL,
  stage_description TEXT,
  required BOOLEAN DEFAULT true,
  approval_type VARCHAR(20) DEFAULT 'sequential',
  required_role VARCHAR(50),
  escalation_days INTEGER DEFAULT 3,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(company_id, stage_order)
);

-- Create approval routing rules table
CREATE TABLE IF NOT EXISTS public.approval_routing_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE,
  rule_name VARCHAR(100) NOT NULL,
  condition_field VARCHAR(50),
  condition_operator VARCHAR(20),
  condition_value TEXT,
  required_stages INTEGER[],
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Create approver assignments table
CREATE TABLE IF NOT EXISTS public.approver_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE,
  stage_order INTEGER NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  role_required VARCHAR(50),
  is_backup BOOLEAN DEFAULT false,
  notification_enabled BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enhance supplier_approval_workflow table
ALTER TABLE public.supplier_approval_workflow 
ADD COLUMN IF NOT EXISTS stage_order INTEGER,
ADD COLUMN IF NOT EXISTS approval_action VARCHAR(20),
ADD COLUMN IF NOT EXISTS approval_comments TEXT,
ADD COLUMN IF NOT EXISTS time_spent_hours NUMERIC(10,2),
ADD COLUMN IF NOT EXISTS notified_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS escalated_to UUID REFERENCES auth.users(id),
ADD COLUMN IF NOT EXISTS documents_verified BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS assigned_to UUID REFERENCES auth.users(id);

-- Enable RLS on new tables
ALTER TABLE public.approval_stages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.approval_routing_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.approver_assignments ENABLE ROW LEVEL SECURITY;

-- RLS Policies for approval_stages
CREATE POLICY "Users can view approval stages"
  ON public.approval_stages FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Admins can manage approval stages"
  ON public.approval_stages FOR ALL
  USING (is_admin(auth.uid()));

-- RLS Policies for approval_routing_rules
CREATE POLICY "Users can view routing rules"
  ON public.approval_routing_rules FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Admins can manage routing rules"
  ON public.approval_routing_rules FOR ALL
  USING (is_admin(auth.uid()));

-- RLS Policies for approver_assignments
CREATE POLICY "Users can view approver assignments"
  ON public.approver_assignments FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Admins can manage approver assignments"
  ON public.approver_assignments FOR ALL
  USING (is_admin(auth.uid()));

-- Function to create default approval stages for a company
CREATE OR REPLACE FUNCTION public.create_default_approval_stages()
RETURNS TRIGGER AS $$
BEGIN
  -- Insert default approval stages for new company
  INSERT INTO public.approval_stages (company_id, stage_order, stage_name, stage_description, required_role, escalation_days)
  VALUES 
    (NEW.id, 1, 'Initial Review', 'Verify supplier information and documents', 'user', 3),
    (NEW.id, 2, 'Procurement Approval', 'Review supplier fit and requirements', 'moderator', 2),
    (NEW.id, 3, 'Finance Review', 'Verify banking details and credit terms', 'moderator', 2),
    (NEW.id, 4, 'Final Approval', 'Executive sign-off for high-value suppliers', 'admin', 1);
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Trigger to create default stages for new companies
CREATE TRIGGER trigger_create_default_approval_stages
  AFTER INSERT ON public.companies
  FOR EACH ROW
  EXECUTE FUNCTION public.create_default_approval_stages();

-- Function to auto-escalate pending approvals
CREATE OR REPLACE FUNCTION public.escalate_pending_approvals()
RETURNS void AS $$
BEGIN
  -- Find approvals pending > escalation_days and escalate to backup
  UPDATE public.supplier_approval_workflow w
  SET 
    assigned_to = a.user_id,
    escalated_to = a.user_id,
    notes = COALESCE(w.notes, '') || ' [Auto-escalated on ' || NOW() || ']',
    notified_at = NOW()
  FROM public.approval_stages s
  LEFT JOIN public.approver_assignments a ON s.stage_order = a.stage_order AND a.is_backup = true AND s.company_id = a.company_id
  WHERE w.stage_order = s.stage_order
    AND w.status = 'pending'
    AND w.created_at < NOW() - (s.escalation_days || ' days')::INTERVAL
    AND a.user_id IS NOT NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Insert default stages for existing companies
INSERT INTO public.approval_stages (company_id, stage_order, stage_name, stage_description, required_role, escalation_days)
SELECT 
  c.id,
  stage_data.stage_order,
  stage_data.stage_name,
  stage_data.stage_description,
  stage_data.required_role,
  stage_data.escalation_days
FROM public.companies c
CROSS JOIN (
  VALUES 
    (1, 'Initial Review', 'Verify supplier information and documents', 'user', 3),
    (2, 'Procurement Approval', 'Review supplier fit and requirements', 'moderator', 2),
    (3, 'Finance Review', 'Verify banking details and credit terms', 'moderator', 2),
    (4, 'Final Approval', 'Executive sign-off for high-value suppliers', 'admin', 1)
) AS stage_data(stage_order, stage_name, stage_description, required_role, escalation_days)
ON CONFLICT (company_id, stage_order) DO NOTHING;