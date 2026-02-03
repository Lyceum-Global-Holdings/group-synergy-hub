-- =====================================================
-- PHASE 2: ACCOUNTS PAYABLE/RECEIVABLE INFRASTRUCTURE
-- Payment Terms, Schedules, and Batch Processing
-- =====================================================

-- ===========================================
-- 1. PAYMENT TERMS TABLE
-- ===========================================

CREATE TABLE IF NOT EXISTS public.payment_terms (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  credit_days INT NOT NULL DEFAULT 30,
  discount_days INT,
  discount_percent NUMERIC(5,2),
  is_default BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  created_by UUID
);

ALTER TABLE public.payment_terms ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view company payment terms"
ON public.payment_terms FOR SELECT TO authenticated
USING (can_access_company(company_id) OR company_id IS NULL);

CREATE POLICY "Users can manage company payment terms"
ON public.payment_terms FOR ALL TO authenticated
USING (can_access_company(company_id))
WITH CHECK (can_access_company(company_id));

-- ===========================================
-- 2. INVOICE PAYMENT SCHEDULE TABLE
-- ===========================================

CREATE TABLE IF NOT EXISTS public.invoice_payment_schedule (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE,
  invoice_id UUID NOT NULL,
  invoice_type TEXT NOT NULL CHECK (invoice_type IN ('customer', 'supplier')),
  installment_number INT DEFAULT 1,
  due_date DATE NOT NULL,
  amount NUMERIC(15,2) NOT NULL,
  discount_date DATE,
  discount_amount NUMERIC(15,2),
  paid_amount NUMERIC(15,2) DEFAULT 0,
  discount_taken NUMERIC(15,2) DEFAULT 0,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'partial', 'paid', 'overdue')),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.invoice_payment_schedule ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view company payment schedules"
ON public.invoice_payment_schedule FOR SELECT TO authenticated
USING (can_access_company(company_id) OR company_id IS NULL);

CREATE POLICY "Users can manage company payment schedules"
ON public.invoice_payment_schedule FOR ALL TO authenticated
USING (can_access_company(company_id))
WITH CHECK (can_access_company(company_id));

-- ===========================================
-- 3. PAYMENT RUNS TABLE (Batch Processing)
-- ===========================================

CREATE TABLE IF NOT EXISTS public.payment_runs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE,
  run_number TEXT NOT NULL,
  payment_date DATE NOT NULL,
  bank_account_id UUID REFERENCES public.bank_accounts(id),
  payment_method TEXT CHECK (payment_method IN ('check', 'eft', 'wire', 'ach', 'manual')),
  total_amount NUMERIC(15,2) DEFAULT 0,
  payment_count INT DEFAULT 0,
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'approved', 'processing', 'completed', 'cancelled')),
  approved_by UUID,
  approved_date TIMESTAMPTZ,
  processed_by UUID,
  processed_date TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  created_by UUID
);

ALTER TABLE public.payment_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view company payment runs"
ON public.payment_runs FOR SELECT TO authenticated
USING (can_access_company(company_id) OR company_id IS NULL);

CREATE POLICY "Users can manage company payment runs"
ON public.payment_runs FOR ALL TO authenticated
USING (can_access_company(company_id))
WITH CHECK (can_access_company(company_id));

-- ===========================================
-- 4. PAYMENT RUN ITEMS TABLE
-- ===========================================

CREATE TABLE IF NOT EXISTS public.payment_run_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  payment_run_id UUID NOT NULL REFERENCES public.payment_runs(id) ON DELETE CASCADE,
  supplier_id UUID REFERENCES public.suppliers(id),
  invoice_id UUID NOT NULL,
  invoice_type TEXT DEFAULT 'supplier',
  invoice_amount NUMERIC(15,2) NOT NULL,
  discount_amount NUMERIC(15,2) DEFAULT 0,
  payment_amount NUMERIC(15,2) NOT NULL,
  check_number TEXT,
  reference_number TEXT,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'failed', 'cancelled')),
  failure_reason TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.payment_run_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view payment run items"
ON public.payment_run_items FOR SELECT TO authenticated
USING (EXISTS (
  SELECT 1 FROM payment_runs pr 
  WHERE pr.id = payment_run_id 
  AND can_access_company(pr.company_id)
));

CREATE POLICY "Users can manage payment run items"
ON public.payment_run_items FOR ALL TO authenticated
USING (EXISTS (
  SELECT 1 FROM payment_runs pr 
  WHERE pr.id = payment_run_id 
  AND can_access_company(pr.company_id)
));

-- ===========================================
-- 5. DUNNING LEVELS TABLE
-- ===========================================

CREATE TABLE IF NOT EXISTS public.dunning_levels (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE,
  level_number INT NOT NULL,
  level_name TEXT NOT NULL,
  days_overdue INT NOT NULL,
  fee_amount NUMERIC(15,2),
  fee_percent NUMERIC(5,2),
  letter_template TEXT,
  email_template TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(company_id, level_number)
);

ALTER TABLE public.dunning_levels ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view company dunning levels"
ON public.dunning_levels FOR SELECT TO authenticated
USING (can_access_company(company_id) OR company_id IS NULL);

CREATE POLICY "Users can manage company dunning levels"
ON public.dunning_levels FOR ALL TO authenticated
USING (can_access_company(company_id))
WITH CHECK (can_access_company(company_id));

-- ===========================================
-- 6. DUNNING HISTORY TABLE
-- ===========================================

CREATE TABLE IF NOT EXISTS public.dunning_history (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE,
  customer_id UUID NOT NULL REFERENCES public.customers(id),
  invoice_id UUID NOT NULL,
  dunning_level_id UUID REFERENCES public.dunning_levels(id),
  dunning_date DATE NOT NULL DEFAULT CURRENT_DATE,
  amount_overdue NUMERIC(15,2) NOT NULL,
  days_overdue INT NOT NULL,
  fee_charged NUMERIC(15,2) DEFAULT 0,
  letter_sent BOOLEAN DEFAULT false,
  email_sent BOOLEAN DEFAULT false,
  response_date DATE,
  response_notes TEXT,
  status TEXT DEFAULT 'sent' CHECK (status IN ('sent', 'acknowledged', 'promised', 'paid', 'disputed', 'escalated')),
  created_at TIMESTAMPTZ DEFAULT now(),
  created_by UUID
);

ALTER TABLE public.dunning_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view company dunning history"
ON public.dunning_history FOR SELECT TO authenticated
USING (can_access_company(company_id) OR company_id IS NULL);

CREATE POLICY "Users can manage company dunning history"
ON public.dunning_history FOR ALL TO authenticated
USING (can_access_company(company_id))
WITH CHECK (can_access_company(company_id));

-- ===========================================
-- 7. INDEXES FOR PERFORMANCE
-- ===========================================

CREATE INDEX IF NOT EXISTS idx_payment_terms_company ON public.payment_terms(company_id);
CREATE INDEX IF NOT EXISTS idx_invoice_payment_schedule_invoice ON public.invoice_payment_schedule(invoice_id, invoice_type);
CREATE INDEX IF NOT EXISTS idx_invoice_payment_schedule_due_date ON public.invoice_payment_schedule(due_date);
CREATE INDEX IF NOT EXISTS idx_payment_runs_company ON public.payment_runs(company_id);
CREATE INDEX IF NOT EXISTS idx_payment_runs_status ON public.payment_runs(status);
CREATE INDEX IF NOT EXISTS idx_dunning_history_customer ON public.dunning_history(customer_id);
CREATE INDEX IF NOT EXISTS idx_dunning_history_invoice ON public.dunning_history(invoice_id);

-- ===========================================
-- 8. INSERT DEFAULT PAYMENT TERMS
-- ===========================================

-- Insert default payment terms (will be associated with company on first use)
INSERT INTO public.payment_terms (id, name, description, credit_days, discount_days, discount_percent, is_default)
VALUES 
  (gen_random_uuid(), 'Net 30', 'Payment due within 30 days', 30, NULL, NULL, true),
  (gen_random_uuid(), 'Net 60', 'Payment due within 60 days', 60, NULL, NULL, false),
  (gen_random_uuid(), '2/10 Net 30', '2% discount if paid within 10 days, otherwise due in 30 days', 30, 10, 2.00, false),
  (gen_random_uuid(), 'Due on Receipt', 'Payment due immediately upon receipt', 0, NULL, NULL, false),
  (gen_random_uuid(), 'Net 15', 'Payment due within 15 days', 15, NULL, NULL, false),
  (gen_random_uuid(), 'Net 45', 'Payment due within 45 days', 45, NULL, NULL, false),
  (gen_random_uuid(), 'Net 90', 'Payment due within 90 days', 90, NULL, NULL, false)
ON CONFLICT DO NOTHING;

COMMENT ON TABLE public.payment_terms IS 'Standard payment terms for invoices with optional early payment discounts';
COMMENT ON TABLE public.invoice_payment_schedule IS 'Payment schedule for invoices with installment support';
COMMENT ON TABLE public.payment_runs IS 'Batch payment processing runs for AP';
COMMENT ON TABLE public.dunning_levels IS 'Configurable dunning levels for AR collections';
COMMENT ON TABLE public.dunning_history IS 'History of dunning actions taken on overdue invoices';