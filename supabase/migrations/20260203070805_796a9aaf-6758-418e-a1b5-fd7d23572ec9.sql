-- =====================================================
-- PHASE 5 & 6: MULTI-CURRENCY & TAX MANAGEMENT
-- Currency, Exchange Rates, Tax Templates
-- =====================================================

-- ===========================================
-- 1. CURRENCIES TABLE
-- ===========================================

CREATE TABLE IF NOT EXISTS public.currencies (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  symbol TEXT,
  decimal_places INT DEFAULT 2,
  is_base_currency BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.currencies ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view currencies"
ON public.currencies FOR SELECT TO authenticated
USING (true);

CREATE POLICY "Admins can manage currencies"
ON public.currencies FOR ALL TO authenticated
USING (true);

-- Insert common currencies
INSERT INTO public.currencies (code, name, symbol, decimal_places, is_base_currency) VALUES
  ('USD', 'US Dollar', '$', 2, true),
  ('EUR', 'Euro', '€', 2, false),
  ('GBP', 'British Pound', '£', 2, false),
  ('LKR', 'Sri Lankan Rupee', 'Rs', 2, false),
  ('INR', 'Indian Rupee', '₹', 2, false),
  ('AED', 'UAE Dirham', 'د.إ', 2, false),
  ('SAR', 'Saudi Riyal', 'ر.س', 2, false),
  ('JPY', 'Japanese Yen', '¥', 0, false),
  ('CNY', 'Chinese Yuan', '¥', 2, false),
  ('AUD', 'Australian Dollar', 'A$', 2, false),
  ('CAD', 'Canadian Dollar', 'C$', 2, false),
  ('CHF', 'Swiss Franc', 'CHF', 2, false),
  ('SGD', 'Singapore Dollar', 'S$', 2, false),
  ('MYR', 'Malaysian Ringgit', 'RM', 2, false),
  ('THB', 'Thai Baht', '฿', 2, false)
ON CONFLICT (code) DO NOTHING;

-- ===========================================
-- 2. EXCHANGE RATES TABLE
-- ===========================================

CREATE TABLE IF NOT EXISTS public.exchange_rates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE,
  from_currency TEXT NOT NULL REFERENCES public.currencies(code),
  to_currency TEXT NOT NULL REFERENCES public.currencies(code),
  rate_date DATE NOT NULL,
  exchange_rate NUMERIC(18,8) NOT NULL,
  rate_type TEXT DEFAULT 'spot' CHECK (rate_type IN ('spot', 'average', 'closing', 'budget')),
  source TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  created_by UUID,
  UNIQUE(company_id, from_currency, to_currency, rate_date, rate_type)
);

ALTER TABLE public.exchange_rates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view company exchange rates"
ON public.exchange_rates FOR SELECT TO authenticated
USING (can_access_company(company_id) OR company_id IS NULL);

CREATE POLICY "Users can manage company exchange rates"
ON public.exchange_rates FOR ALL TO authenticated
USING (can_access_company(company_id))
WITH CHECK (can_access_company(company_id));

-- ===========================================
-- 3. TAX TEMPLATES TABLE
-- ===========================================

CREATE TABLE IF NOT EXISTS public.tax_templates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  tax_type TEXT NOT NULL CHECK (tax_type IN ('vat', 'gst', 'sales_tax', 'withholding', 'excise', 'custom')),
  is_default BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,
  applies_to TEXT DEFAULT 'both' CHECK (applies_to IN ('sales', 'purchases', 'both')),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  created_by UUID
);

ALTER TABLE public.tax_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view company tax templates"
ON public.tax_templates FOR SELECT TO authenticated
USING (can_access_company(company_id) OR company_id IS NULL);

CREATE POLICY "Users can manage company tax templates"
ON public.tax_templates FOR ALL TO authenticated
USING (can_access_company(company_id))
WITH CHECK (can_access_company(company_id));

-- ===========================================
-- 4. TAX TEMPLATE DETAILS TABLE
-- ===========================================

CREATE TABLE IF NOT EXISTS public.tax_template_details (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  template_id UUID NOT NULL REFERENCES public.tax_templates(id) ON DELETE CASCADE,
  tax_component_name TEXT NOT NULL,
  tax_rate NUMERIC(8,4) NOT NULL,
  account_id UUID REFERENCES public.chart_of_accounts(id),
  is_included_in_price BOOLEAN DEFAULT false,
  is_compound BOOLEAN DEFAULT false,
  calculation_order INT DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.tax_template_details ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view tax template details"
ON public.tax_template_details FOR SELECT TO authenticated
USING (EXISTS (
  SELECT 1 FROM tax_templates tt 
  WHERE tt.id = template_id 
  AND (can_access_company(tt.company_id) OR tt.company_id IS NULL)
));

CREATE POLICY "Users can manage tax template details"
ON public.tax_template_details FOR ALL TO authenticated
USING (EXISTS (
  SELECT 1 FROM tax_templates tt 
  WHERE tt.id = template_id 
  AND can_access_company(tt.company_id)
));

-- ===========================================
-- 5. TAX RETURNS TABLE
-- ===========================================

CREATE TABLE IF NOT EXISTS public.tax_returns (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE,
  return_period TEXT NOT NULL,
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  tax_type TEXT NOT NULL,
  output_tax NUMERIC(15,2) DEFAULT 0,
  input_tax NUMERIC(15,2) DEFAULT 0,
  net_tax_payable NUMERIC(15,2) DEFAULT 0,
  adjustments NUMERIC(15,2) DEFAULT 0,
  total_due NUMERIC(15,2) DEFAULT 0,
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'calculated', 'submitted', 'filed', 'paid', 'amended')),
  filing_date DATE,
  payment_date DATE,
  reference_number TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  created_by UUID
);

ALTER TABLE public.tax_returns ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view company tax returns"
ON public.tax_returns FOR SELECT TO authenticated
USING (can_access_company(company_id) OR company_id IS NULL);

CREATE POLICY "Users can manage company tax returns"
ON public.tax_returns FOR ALL TO authenticated
USING (can_access_company(company_id))
WITH CHECK (can_access_company(company_id));

-- ===========================================
-- 6. TAX RETURN LINES TABLE
-- ===========================================

CREATE TABLE IF NOT EXISTS public.tax_return_lines (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  return_id UUID NOT NULL REFERENCES public.tax_returns(id) ON DELETE CASCADE,
  line_number INT NOT NULL,
  category TEXT NOT NULL,
  description TEXT,
  taxable_amount NUMERIC(15,2) DEFAULT 0,
  tax_amount NUMERIC(15,2) DEFAULT 0,
  invoice_count INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.tax_return_lines ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view tax return lines"
ON public.tax_return_lines FOR SELECT TO authenticated
USING (EXISTS (
  SELECT 1 FROM tax_returns tr 
  WHERE tr.id = return_id 
  AND can_access_company(tr.company_id)
));

CREATE POLICY "Users can manage tax return lines"
ON public.tax_return_lines FOR ALL TO authenticated
USING (EXISTS (
  SELECT 1 FROM tax_returns tr 
  WHERE tr.id = return_id 
  AND can_access_company(tr.company_id)
));

-- ===========================================
-- 7. PERIOD CLOSE TASKS TABLE
-- ===========================================

CREATE TABLE IF NOT EXISTS public.period_close_tasks (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE,
  period_id UUID REFERENCES public.accounting_periods(id) ON DELETE CASCADE,
  task_order INT NOT NULL,
  task_name TEXT NOT NULL,
  task_type TEXT NOT NULL CHECK (task_type IN ('manual', 'automatic', 'verification')),
  task_category TEXT CHECK (task_category IN ('gl', 'ap', 'ar', 'fa', 'bank', 'tax', 'inventory')),
  description TEXT,
  is_required BOOLEAN DEFAULT true,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed', 'skipped', 'failed')),
  completed_by UUID,
  completed_at TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.period_close_tasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view company period close tasks"
ON public.period_close_tasks FOR SELECT TO authenticated
USING (can_access_company(company_id) OR company_id IS NULL);

CREATE POLICY "Users can manage company period close tasks"
ON public.period_close_tasks FOR ALL TO authenticated
USING (can_access_company(company_id))
WITH CHECK (can_access_company(company_id));

-- ===========================================
-- 8. FX REVALUATION FUNCTION
-- ===========================================

CREATE OR REPLACE FUNCTION public.run_fx_revaluation(
  p_company_id UUID,
  p_as_of_date DATE,
  p_base_currency TEXT DEFAULT 'USD'
)
RETURNS TABLE (
  account_id UUID,
  account_code TEXT,
  account_name TEXT,
  currency TEXT,
  foreign_balance NUMERIC,
  original_base_balance NUMERIC,
  current_rate NUMERIC,
  revalued_balance NUMERIC,
  unrealized_gain_loss NUMERIC
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- This is a placeholder - full implementation would calculate unrealized FX gains/losses
  RETURN QUERY
  SELECT 
    coa.id as account_id,
    coa.account_code,
    coa.account_name,
    COALESCE(coa.currency, p_base_currency) as currency,
    COALESCE(SUM(jel.debit_amount - jel.credit_amount), 0) as foreign_balance,
    COALESCE(SUM(jel.debit_amount - jel.credit_amount), 0) as original_base_balance,
    1.0::NUMERIC as current_rate,
    COALESCE(SUM(jel.debit_amount - jel.credit_amount), 0) as revalued_balance,
    0::NUMERIC as unrealized_gain_loss
  FROM chart_of_accounts coa
  LEFT JOIN journal_entry_lines jel ON jel.account_id = coa.id
  LEFT JOIN journal_entries je ON je.id = jel.journal_entry_id 
    AND je.status = 'posted'
    AND je.journal_date <= p_as_of_date
  WHERE coa.company_id = p_company_id
    AND coa.account_type IN ('Bank', 'Cash', 'Receivable', 'Payable')
    AND coa.is_active = true
  GROUP BY coa.id, coa.account_code, coa.account_name, coa.currency
  HAVING COALESCE(SUM(jel.debit_amount - jel.credit_amount), 0) != 0;
END;
$$;

GRANT EXECUTE ON FUNCTION public.run_fx_revaluation TO authenticated;

-- ===========================================
-- 9. INDEXES FOR PERFORMANCE
-- ===========================================

CREATE INDEX IF NOT EXISTS idx_exchange_rates_currencies ON public.exchange_rates(from_currency, to_currency);
CREATE INDEX IF NOT EXISTS idx_exchange_rates_date ON public.exchange_rates(rate_date);
CREATE INDEX IF NOT EXISTS idx_tax_templates_company ON public.tax_templates(company_id);
CREATE INDEX IF NOT EXISTS idx_tax_returns_company_period ON public.tax_returns(company_id, period_start, period_end);
CREATE INDEX IF NOT EXISTS idx_period_close_tasks_period ON public.period_close_tasks(period_id);

-- Insert default tax templates
INSERT INTO public.tax_templates (name, description, tax_type, is_default, applies_to) VALUES
  ('Standard VAT', 'Standard Value Added Tax', 'vat', true, 'both'),
  ('Zero Rated', 'Zero rated supplies', 'vat', false, 'sales'),
  ('Exempt', 'VAT exempt supplies', 'vat', false, 'sales'),
  ('Withholding Tax 5%', '5% withholding tax on services', 'withholding', false, 'purchases'),
  ('Withholding Tax 10%', '10% withholding tax', 'withholding', false, 'purchases')
ON CONFLICT DO NOTHING;

COMMENT ON TABLE public.currencies IS 'Master list of currencies supported by the system';
COMMENT ON TABLE public.exchange_rates IS 'Historical exchange rates for multi-currency transactions';
COMMENT ON TABLE public.tax_templates IS 'Configurable tax calculation templates';
COMMENT ON TABLE public.tax_returns IS 'Tax return filings and calculations';
COMMENT ON TABLE public.period_close_tasks IS 'Month-end and year-end closing checklist tasks';