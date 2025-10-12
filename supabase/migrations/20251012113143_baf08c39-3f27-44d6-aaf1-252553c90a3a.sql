-- Create enums for risk management
CREATE TYPE public.risk_severity AS ENUM ('low', 'medium', 'high', 'critical');
CREATE TYPE public.risk_category AS ENUM ('quality', 'delivery', 'financial', 'compliance', 'ethical', 'legal', 'operational', 'other');
CREATE TYPE public.risk_flag_status AS ENUM ('active', 'resolved', 'under_review', 'escalated');
CREATE TYPE public.blacklist_status AS ENUM ('blacklisted', 'watchlist', 'cleared');
CREATE TYPE public.action_type AS ENUM ('flagged', 'blacklisted', 'cleared', 'escalated', 'resolved', 'updated', 'reviewed');

-- Create supplier_risk_flags table
CREATE TABLE public.supplier_risk_flags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_id UUID NOT NULL REFERENCES public.suppliers(id) ON DELETE CASCADE,
  risk_category public.risk_category NOT NULL,
  risk_severity public.risk_severity NOT NULL,
  status public.risk_flag_status NOT NULL DEFAULT 'active',
  title TEXT NOT NULL,
  description TEXT,
  evidence_urls JSONB DEFAULT '[]'::jsonb,
  financial_impact NUMERIC(15,2),
  flagged_date DATE NOT NULL DEFAULT CURRENT_DATE,
  flagged_by UUID REFERENCES auth.users(id),
  resolved_date DATE,
  resolved_by UUID REFERENCES auth.users(id),
  resolution_notes TEXT,
  review_date DATE,
  next_review_date DATE,
  auto_alert_enabled BOOLEAN DEFAULT true,
  company_id UUID REFERENCES public.companies(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create supplier_blacklist table
CREATE TABLE public.supplier_blacklist (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_id UUID NOT NULL UNIQUE REFERENCES public.suppliers(id) ON DELETE CASCADE,
  status public.blacklist_status NOT NULL DEFAULT 'blacklisted',
  blacklist_reason TEXT NOT NULL,
  blacklisted_date DATE NOT NULL DEFAULT CURRENT_DATE,
  blacklisted_by UUID REFERENCES auth.users(id),
  cleared_date DATE,
  cleared_by UUID REFERENCES auth.users(id),
  clearing_reason TEXT,
  permanent BOOLEAN DEFAULT false,
  review_required BOOLEAN DEFAULT true,
  review_frequency_days INTEGER DEFAULT 90,
  next_review_date DATE,
  related_risk_flags JSONB DEFAULT '[]'::jsonb,
  restrictions JSONB DEFAULT '{}'::jsonb,
  company_id UUID REFERENCES public.companies(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create risk_flag_history table
CREATE TABLE public.risk_flag_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  risk_flag_id UUID NOT NULL REFERENCES public.supplier_risk_flags(id) ON DELETE CASCADE,
  action_type public.action_type NOT NULL,
  action_date TIMESTAMP WITH TIME ZONE DEFAULT now(),
  performed_by UUID REFERENCES auth.users(id),
  previous_status public.risk_flag_status,
  new_status public.risk_flag_status,
  notes TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create blacklist_reviews table
CREATE TABLE public.blacklist_reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  blacklist_id UUID NOT NULL REFERENCES public.supplier_blacklist(id) ON DELETE CASCADE,
  review_date DATE NOT NULL DEFAULT CURRENT_DATE,
  reviewed_by UUID REFERENCES auth.users(id),
  decision TEXT NOT NULL CHECK (decision IN ('maintain', 'clear', 'escalate')),
  recommendation TEXT,
  next_review_date DATE,
  supporting_evidence JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create risk_alert_rules table
CREATE TABLE public.risk_alert_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rule_name TEXT NOT NULL,
  risk_category public.risk_category,
  min_severity public.risk_severity NOT NULL,
  alert_recipients JSONB DEFAULT '[]'::jsonb,
  alert_on_creation BOOLEAN DEFAULT true,
  alert_on_escalation BOOLEAN DEFAULT true,
  alert_frequency_days INTEGER,
  is_active BOOLEAN DEFAULT true,
  company_id UUID REFERENCES public.companies(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create indexes for performance
CREATE INDEX idx_risk_flags_supplier ON public.supplier_risk_flags(supplier_id);
CREATE INDEX idx_risk_flags_status ON public.supplier_risk_flags(status);
CREATE INDEX idx_risk_flags_severity ON public.supplier_risk_flags(risk_severity);
CREATE INDEX idx_risk_flags_company ON public.supplier_risk_flags(company_id);
CREATE INDEX idx_blacklist_supplier ON public.supplier_blacklist(supplier_id);
CREATE INDEX idx_blacklist_status ON public.supplier_blacklist(status);
CREATE INDEX idx_blacklist_company ON public.supplier_blacklist(company_id);
CREATE INDEX idx_risk_history_flag ON public.risk_flag_history(risk_flag_id);
CREATE INDEX idx_blacklist_reviews_blacklist ON public.blacklist_reviews(blacklist_id);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers for updated_at
CREATE TRIGGER update_risk_flags_updated_at
  BEFORE UPDATE ON public.supplier_risk_flags
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_blacklist_updated_at
  BEFORE UPDATE ON public.supplier_blacklist
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_alert_rules_updated_at
  BEFORE UPDATE ON public.risk_alert_rules
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Function to log risk flag changes
CREATE OR REPLACE FUNCTION public.log_risk_flag_change()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.risk_flag_history (
      risk_flag_id,
      action_type,
      performed_by,
      new_status,
      notes
    ) VALUES (
      NEW.id,
      'flagged',
      NEW.flagged_by,
      NEW.status,
      'Risk flag created'
    );
  ELSIF TG_OP = 'UPDATE' AND OLD.status != NEW.status THEN
    INSERT INTO public.risk_flag_history (
      risk_flag_id,
      action_type,
      performed_by,
      previous_status,
      new_status,
      notes
    ) VALUES (
      NEW.id,
      CASE 
        WHEN NEW.status = 'resolved' THEN 'resolved'
        WHEN NEW.status = 'escalated' THEN 'escalated'
        ELSE 'updated'
      END,
      auth.uid(),
      OLD.status,
      NEW.status,
      'Status changed from ' || OLD.status || ' to ' || NEW.status
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Trigger for risk flag history
CREATE TRIGGER log_risk_flag_changes
  AFTER INSERT OR UPDATE ON public.supplier_risk_flags
  FOR EACH ROW
  EXECUTE FUNCTION public.log_risk_flag_change();

-- Function to update supplier status when blacklisted
CREATE OR REPLACE FUNCTION public.update_supplier_on_blacklist()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' OR (TG_OP = 'UPDATE' AND NEW.status != OLD.status) THEN
    UPDATE public.suppliers
    SET status = CASE 
      WHEN NEW.status = 'blacklisted' THEN 'inactive'
      WHEN NEW.status = 'cleared' THEN 'active'
      ELSE status
    END,
    updated_at = now()
    WHERE id = NEW.supplier_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Trigger for supplier status sync
CREATE TRIGGER sync_supplier_status_on_blacklist
  AFTER INSERT OR UPDATE ON public.supplier_blacklist
  FOR EACH ROW
  EXECUTE FUNCTION public.update_supplier_on_blacklist();

-- Function to schedule next review
CREATE OR REPLACE FUNCTION public.schedule_next_blacklist_review()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.review_required AND NEW.review_frequency_days IS NOT NULL THEN
    NEW.next_review_date := NEW.blacklisted_date + (NEW.review_frequency_days || ' days')::INTERVAL;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for scheduling reviews
CREATE TRIGGER auto_schedule_blacklist_review
  BEFORE INSERT OR UPDATE ON public.supplier_blacklist
  FOR EACH ROW
  EXECUTE FUNCTION public.schedule_next_blacklist_review();

-- Function to calculate supplier risk score
CREATE OR REPLACE FUNCTION public.calculate_supplier_risk_score(p_supplier_id UUID)
RETURNS NUMERIC AS $$
DECLARE
  v_risk_score NUMERIC := 0;
  v_critical_count INTEGER;
  v_high_count INTEGER;
  v_medium_count INTEGER;
  v_active_flags INTEGER;
BEGIN
  SELECT 
    COUNT(*) FILTER (WHERE risk_severity = 'critical'),
    COUNT(*) FILTER (WHERE risk_severity = 'high'),
    COUNT(*) FILTER (WHERE risk_severity = 'medium'),
    COUNT(*)
  INTO v_critical_count, v_high_count, v_medium_count, v_active_flags
  FROM public.supplier_risk_flags
  WHERE supplier_id = p_supplier_id 
    AND status IN ('active', 'escalated');
  
  -- Weighted risk scoring
  v_risk_score := (v_critical_count * 10) + (v_high_count * 5) + (v_medium_count * 2);
  
  RETURN v_risk_score;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public;

-- Enable RLS on all tables
ALTER TABLE public.supplier_risk_flags ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.supplier_blacklist ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.risk_flag_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.blacklist_reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.risk_alert_rules ENABLE ROW LEVEL SECURITY;

-- RLS Policies for supplier_risk_flags
CREATE POLICY "Users can view risk flags for accessible suppliers"
  ON public.supplier_risk_flags FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Users can create risk flags"
  ON public.supplier_risk_flags FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL AND auth.uid() = flagged_by);

CREATE POLICY "Users can update risk flags they created or admins"
  ON public.supplier_risk_flags FOR UPDATE
  USING (auth.uid() = flagged_by OR is_admin(auth.uid()));

CREATE POLICY "Admins can delete risk flags"
  ON public.supplier_risk_flags FOR DELETE
  USING (is_admin(auth.uid()));

-- RLS Policies for supplier_blacklist
CREATE POLICY "Users can view blacklist entries"
  ON public.supplier_blacklist FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Admins can create blacklist entries"
  ON public.supplier_blacklist FOR INSERT
  WITH CHECK (is_admin(auth.uid()) AND auth.uid() = blacklisted_by);

CREATE POLICY "Admins can update blacklist entries"
  ON public.supplier_blacklist FOR UPDATE
  USING (is_admin(auth.uid()));

CREATE POLICY "Admins can delete blacklist entries"
  ON public.supplier_blacklist FOR DELETE
  USING (is_admin(auth.uid()));

-- RLS Policies for risk_flag_history (read-only for users)
CREATE POLICY "Users can view risk flag history"
  ON public.risk_flag_history FOR SELECT
  USING (auth.uid() IS NOT NULL);

-- RLS Policies for blacklist_reviews
CREATE POLICY "Users can view blacklist reviews"
  ON public.blacklist_reviews FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Admins can create blacklist reviews"
  ON public.blacklist_reviews FOR INSERT
  WITH CHECK (is_admin(auth.uid()) AND auth.uid() = reviewed_by);

CREATE POLICY "Admins can update blacklist reviews"
  ON public.blacklist_reviews FOR UPDATE
  USING (is_admin(auth.uid()));

-- RLS Policies for risk_alert_rules
CREATE POLICY "Users can view alert rules"
  ON public.risk_alert_rules FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Admins can manage alert rules"
  ON public.risk_alert_rules FOR ALL
  USING (is_admin(auth.uid()));