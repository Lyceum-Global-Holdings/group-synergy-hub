-- General Ledger Module - Complete Database Schema

-- ============================================================
-- ENUMS
-- ============================================================

CREATE TYPE account_type AS ENUM ('asset', 'liability', 'equity', 'revenue', 'expense');
CREATE TYPE account_category AS ENUM (
  'current_asset', 'fixed_asset', 'other_asset',
  'current_liability', 'long_term_liability',
  'equity', 'retained_earnings',
  'operating_revenue', 'other_revenue',
  'operating_expense', 'cogs', 'other_expense'
);
CREATE TYPE normal_balance AS ENUM ('debit', 'credit');
CREATE TYPE journal_type AS ENUM (
  'manual', 'system_generated', 'opening_balance', 
  'closing', 'adjusting', 'reversing', 'recurring'
);
CREATE TYPE journal_status AS ENUM ('draft', 'posted', 'void', 'reversed');
CREATE TYPE period_status AS ENUM ('open', 'closed', 'locked');

-- ============================================================
-- TABLES
-- ============================================================

-- Chart of Accounts
CREATE TABLE chart_of_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_code TEXT NOT NULL,
  account_name TEXT NOT NULL,
  account_type account_type NOT NULL,
  account_category account_category NOT NULL,
  parent_account_id UUID REFERENCES chart_of_accounts(id),
  level INTEGER NOT NULL DEFAULT 1,
  is_header BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,
  is_control_account BOOLEAN DEFAULT false,
  normal_balance normal_balance NOT NULL,
  opening_balance NUMERIC(15,2) DEFAULT 0,
  opening_balance_date DATE,
  current_balance NUMERIC(15,2) DEFAULT 0,
  currency TEXT DEFAULT 'LKR',
  cost_center_id UUID,
  notes TEXT,
  company_id UUID,
  created_by UUID,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(company_id, account_code)
);

-- Cost Centers
CREATE TABLE cost_centers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  parent_id UUID REFERENCES cost_centers(id),
  is_active BOOLEAN DEFAULT true,
  manager_id UUID,
  company_id UUID,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(company_id, code)
);

-- Tax Codes
CREATE TABLE tax_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tax_code TEXT NOT NULL,
  tax_name TEXT NOT NULL,
  tax_rate NUMERIC(5,2) NOT NULL,
  tax_type TEXT NOT NULL,
  gl_account_id UUID REFERENCES chart_of_accounts(id),
  is_active BOOLEAN DEFAULT true,
  company_id UUID,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(company_id, tax_code)
);

-- Fiscal Years
CREATE TABLE fiscal_years (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  year_name TEXT NOT NULL,
  fiscal_year INTEGER NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  status period_status DEFAULT 'open',
  is_current BOOLEAN DEFAULT false,
  company_id UUID,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(company_id, fiscal_year)
);

-- Accounting Periods
CREATE TABLE accounting_periods (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  period_name TEXT NOT NULL,
  fiscal_year INTEGER NOT NULL,
  period_number INTEGER NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  status period_status DEFAULT 'open',
  closed_by UUID,
  closed_date TIMESTAMP WITH TIME ZONE,
  company_id UUID,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(company_id, fiscal_year, period_number)
);

-- Journal Entries
CREATE TABLE journal_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  journal_number TEXT NOT NULL,
  journal_date DATE NOT NULL,
  journal_type journal_type DEFAULT 'manual',
  reference_type TEXT,
  reference_id UUID,
  reference_number TEXT,
  description TEXT NOT NULL,
  total_debit NUMERIC(15,2) DEFAULT 0,
  total_credit NUMERIC(15,2) DEFAULT 0,
  is_balanced BOOLEAN DEFAULT false,
  status journal_status DEFAULT 'draft',
  period_id UUID REFERENCES accounting_periods(id),
  fiscal_year INTEGER,
  period_month INTEGER,
  posted_by UUID,
  posted_date TIMESTAMP WITH TIME ZONE,
  reversed_by UUID,
  reversed_date TIMESTAMP WITH TIME ZONE,
  reversal_je_id UUID REFERENCES journal_entries(id),
  is_recurring BOOLEAN DEFAULT false,
  recurrence_pattern JSONB,
  tags TEXT[],
  attachments JSONB,
  approval_required BOOLEAN DEFAULT false,
  approved_by UUID,
  approved_date TIMESTAMP WITH TIME ZONE,
  company_id UUID,
  created_by UUID,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(company_id, journal_number)
);

-- Journal Entry Lines
CREATE TABLE journal_entry_lines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  journal_entry_id UUID NOT NULL REFERENCES journal_entries(id) ON DELETE CASCADE,
  line_number INTEGER NOT NULL,
  account_id UUID NOT NULL REFERENCES chart_of_accounts(id),
  description TEXT,
  debit_amount NUMERIC(15,2) DEFAULT 0,
  credit_amount NUMERIC(15,2) DEFAULT 0,
  currency TEXT DEFAULT 'LKR',
  exchange_rate NUMERIC(10,4) DEFAULT 1,
  base_currency_amount NUMERIC(15,2) DEFAULT 0,
  cost_center_id UUID REFERENCES cost_centers(id),
  department_id UUID,
  project_id UUID,
  supplier_id UUID,
  customer_id UUID,
  item_id UUID,
  tax_code_id UUID REFERENCES tax_codes(id),
  tax_amount NUMERIC(15,2) DEFAULT 0,
  dimension_1 TEXT,
  dimension_2 TEXT,
  dimension_3 TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Recurring Journal Templates
CREATE TABLE recurring_journal_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_name TEXT NOT NULL,
  description TEXT,
  frequency TEXT NOT NULL,
  day_of_period INTEGER,
  status TEXT DEFAULT 'active',
  start_date DATE NOT NULL,
  end_date DATE,
  last_generated_date DATE,
  next_generation_date DATE,
  auto_post BOOLEAN DEFAULT false,
  template_lines JSONB,
  company_id UUID,
  created_by UUID,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Transaction to GL Mapping (for integration)
CREATE TABLE transaction_to_gl_mapping (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_type TEXT NOT NULL,
  description TEXT,
  debit_account_id UUID REFERENCES chart_of_accounts(id),
  credit_account_id UUID REFERENCES chart_of_accounts(id),
  is_default BOOLEAN DEFAULT false,
  company_id UUID,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(company_id, transaction_type)
);

-- ============================================================
-- INDEXES
-- ============================================================

CREATE INDEX idx_coa_company_type ON chart_of_accounts(company_id, account_type);
CREATE INDEX idx_coa_parent ON chart_of_accounts(parent_account_id);
CREATE INDEX idx_coa_code ON chart_of_accounts(account_code);

CREATE INDEX idx_je_company_date ON journal_entries(company_id, journal_date);
CREATE INDEX idx_je_status ON journal_entries(status);
CREATE INDEX idx_je_period ON journal_entries(period_id);
CREATE INDEX idx_je_fiscal_year ON journal_entries(fiscal_year, period_month);

CREATE INDEX idx_jel_je ON journal_entry_lines(journal_entry_id);
CREATE INDEX idx_jel_account ON journal_entry_lines(account_id);

CREATE INDEX idx_period_company_year ON accounting_periods(company_id, fiscal_year);

-- ============================================================
-- FUNCTIONS
-- ============================================================

-- Generate Journal Entry Number
CREATE OR REPLACE FUNCTION generate_journal_entry_number()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  next_number INTEGER;
  new_je_number TEXT;
BEGIN
  SELECT COALESCE(MAX(CAST(SUBSTRING(journal_number FROM 'JE-' || TO_CHAR(CURRENT_DATE, 'YYYYMMDD') || '-(.*)') AS INTEGER)), 0) + 1
  INTO next_number
  FROM journal_entries
  WHERE journal_number LIKE 'JE-' || TO_CHAR(CURRENT_DATE, 'YYYYMMDD') || '-%';
  
  new_je_number := 'JE-' || TO_CHAR(CURRENT_DATE, 'YYYYMMDD') || '-' || LPAD(next_number::TEXT, 3, '0');
  RETURN new_je_number;
END;
$$;

-- Auto-generate JE number trigger
CREATE OR REPLACE FUNCTION auto_generate_je_number()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.journal_number IS NULL OR NEW.journal_number = '' THEN
    NEW.journal_number := generate_journal_entry_number();
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trigger_auto_generate_je_number
  BEFORE INSERT ON journal_entries
  FOR EACH ROW EXECUTE FUNCTION auto_generate_je_number();

-- Validate JE balance
CREATE OR REPLACE FUNCTION validate_journal_entry_balance()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  total_debit NUMERIC;
  total_credit NUMERIC;
BEGIN
  SELECT 
    COALESCE(SUM(debit_amount), 0),
    COALESCE(SUM(credit_amount), 0)
  INTO total_debit, total_credit
  FROM journal_entry_lines
  WHERE journal_entry_id = NEW.id;
  
  IF total_debit != total_credit THEN
    RAISE EXCEPTION 'Journal entry is not balanced. Debit: %, Credit: %', total_debit, total_credit;
  END IF;
  
  NEW.is_balanced := true;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trigger_validate_je_before_post
  BEFORE UPDATE ON journal_entries
  FOR EACH ROW 
  WHEN (NEW.status = 'posted' AND OLD.status != 'posted')
  EXECUTE FUNCTION validate_journal_entry_balance();

-- Calculate JE totals
CREATE OR REPLACE FUNCTION calculate_je_totals()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  UPDATE journal_entries
  SET 
    total_debit = (SELECT COALESCE(SUM(debit_amount), 0) FROM journal_entry_lines WHERE journal_entry_id = COALESCE(NEW.journal_entry_id, OLD.journal_entry_id)),
    total_credit = (SELECT COALESCE(SUM(credit_amount), 0) FROM journal_entry_lines WHERE journal_entry_id = COALESCE(NEW.journal_entry_id, OLD.journal_entry_id)),
    updated_at = now()
  WHERE id = COALESCE(NEW.journal_entry_id, OLD.journal_entry_id);
  
  RETURN COALESCE(NEW, OLD);
END;
$$;

CREATE TRIGGER trigger_calculate_je_totals
  AFTER INSERT OR UPDATE OR DELETE ON journal_entry_lines
  FOR EACH ROW EXECUTE FUNCTION calculate_je_totals();

-- Update account balances on JE post
CREATE OR REPLACE FUNCTION update_account_balances_on_post()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  -- Update current balance for all accounts in this JE
  UPDATE chart_of_accounts coa
  SET 
    current_balance = CASE 
      WHEN coa.normal_balance = 'debit' 
      THEN coa.opening_balance + (
        SELECT COALESCE(SUM(jel.debit_amount - jel.credit_amount), 0)
        FROM journal_entry_lines jel
        JOIN journal_entries je ON jel.journal_entry_id = je.id
        WHERE jel.account_id = coa.id AND je.status = 'posted'
      )
      ELSE coa.opening_balance + (
        SELECT COALESCE(SUM(jel.credit_amount - jel.debit_amount), 0)
        FROM journal_entry_lines jel
        JOIN journal_entries je ON jel.journal_entry_id = je.id
        WHERE jel.account_id = coa.id AND je.status = 'posted'
      )
    END,
    updated_at = now()
  WHERE coa.id IN (
    SELECT account_id FROM journal_entry_lines WHERE journal_entry_id = NEW.id
  );
  
  RETURN NEW;
END;
$$;

CREATE TRIGGER trigger_update_account_balances
  AFTER UPDATE ON journal_entries
  FOR EACH ROW
  WHEN (NEW.status = 'posted' AND OLD.status != 'posted')
  EXECUTE FUNCTION update_account_balances_on_post();

-- Check period status before posting
CREATE OR REPLACE FUNCTION check_period_status()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  period_stat period_status;
BEGIN
  IF NEW.period_id IS NOT NULL THEN
    SELECT status INTO period_stat
    FROM accounting_periods
    WHERE id = NEW.period_id;
    
    IF period_stat IN ('closed', 'locked') THEN
      RAISE EXCEPTION 'Cannot post to a closed or locked period';
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

CREATE TRIGGER trigger_prevent_closed_period_posting
  BEFORE INSERT OR UPDATE ON journal_entries
  FOR EACH ROW 
  WHEN (NEW.status = 'posted')
  EXECUTE FUNCTION check_period_status();

-- Get Trial Balance function
CREATE OR REPLACE FUNCTION get_trial_balance(
  p_as_of_date DATE,
  p_company_id UUID
)
RETURNS TABLE (
  account_code TEXT,
  account_name TEXT,
  account_type TEXT,
  debit_balance NUMERIC,
  credit_balance NUMERIC
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    coa.account_code,
    coa.account_name,
    coa.account_type::TEXT,
    CASE 
      WHEN coa.normal_balance = 'debit' AND coa.current_balance >= 0 THEN coa.current_balance
      WHEN coa.normal_balance = 'debit' AND coa.current_balance < 0 THEN 0
      WHEN coa.normal_balance = 'credit' AND coa.current_balance < 0 THEN ABS(coa.current_balance)
      ELSE 0
    END as debit_balance,
    CASE 
      WHEN coa.normal_balance = 'credit' AND coa.current_balance >= 0 THEN coa.current_balance
      WHEN coa.normal_balance = 'credit' AND coa.current_balance < 0 THEN 0
      WHEN coa.normal_balance = 'debit' AND coa.current_balance < 0 THEN ABS(coa.current_balance)
      ELSE 0
    END as credit_balance
  FROM chart_of_accounts coa
  WHERE coa.company_id = p_company_id
    AND coa.is_active = true
    AND coa.is_header = false
  ORDER BY coa.account_code;
END;
$$;

-- ============================================================
-- VIEWS
-- ============================================================

CREATE VIEW v_active_accounts_with_balances AS
SELECT 
  coa.*,
  COALESCE(SUM(CASE WHEN je.status = 'posted' THEN jel.debit_amount ELSE 0 END), 0) as total_debits,
  COALESCE(SUM(CASE WHEN je.status = 'posted' THEN jel.credit_amount ELSE 0 END), 0) as total_credits
FROM chart_of_accounts coa
LEFT JOIN journal_entry_lines jel ON coa.id = jel.account_id
LEFT JOIN journal_entries je ON jel.journal_entry_id = je.id
WHERE coa.is_active = true
GROUP BY coa.id;

-- ============================================================
-- RLS POLICIES
-- ============================================================

ALTER TABLE chart_of_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE cost_centers ENABLE ROW LEVEL SECURITY;
ALTER TABLE tax_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE fiscal_years ENABLE ROW LEVEL SECURITY;
ALTER TABLE accounting_periods ENABLE ROW LEVEL SECURITY;
ALTER TABLE journal_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE journal_entry_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE recurring_journal_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE transaction_to_gl_mapping ENABLE ROW LEVEL SECURITY;

-- Chart of Accounts policies
CREATE POLICY "Users can view COA for their company"
  ON chart_of_accounts FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Users can create COA accounts"
  ON chart_of_accounts FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL AND auth.uid() = created_by);

CREATE POLICY "Users can update COA accounts"
  ON chart_of_accounts FOR UPDATE
  USING (auth.uid() = created_by OR is_admin(auth.uid()));

CREATE POLICY "Admins can delete COA accounts"
  ON chart_of_accounts FOR DELETE
  USING (is_admin(auth.uid()));

-- Journal Entries policies
CREATE POLICY "Users can view journal entries"
  ON journal_entries FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Users can create journal entries"
  ON journal_entries FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL AND auth.uid() = created_by);

CREATE POLICY "Users can update draft journal entries"
  ON journal_entries FOR UPDATE
  USING (auth.uid() = created_by OR is_admin(auth.uid()));

CREATE POLICY "Admins can delete journal entries"
  ON journal_entries FOR DELETE
  USING (is_admin(auth.uid()) AND status = 'draft');

-- Journal Entry Lines policies
CREATE POLICY "Users can view JE lines"
  ON journal_entry_lines FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Users can manage JE lines for their JEs"
  ON journal_entry_lines FOR ALL
  USING (EXISTS (
    SELECT 1 FROM journal_entries 
    WHERE id = journal_entry_lines.journal_entry_id 
    AND (created_by = auth.uid() OR is_admin(auth.uid()))
  ));

-- Cost Centers policies
CREATE POLICY "Users can view cost centers"
  ON cost_centers FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Admins can manage cost centers"
  ON cost_centers FOR ALL
  USING (is_admin(auth.uid()));

-- Tax Codes policies
CREATE POLICY "Users can view tax codes"
  ON tax_codes FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Admins can manage tax codes"
  ON tax_codes FOR ALL
  USING (is_admin(auth.uid()));

-- Fiscal Years policies
CREATE POLICY "Users can view fiscal years"
  ON fiscal_years FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Admins can manage fiscal years"
  ON fiscal_years FOR ALL
  USING (is_admin(auth.uid()));

-- Accounting Periods policies
CREATE POLICY "Users can view accounting periods"
  ON accounting_periods FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Admins can manage accounting periods"
  ON accounting_periods FOR ALL
  USING (is_admin(auth.uid()));

-- Recurring Templates policies
CREATE POLICY "Users can view recurring templates"
  ON recurring_journal_templates FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Users can manage their recurring templates"
  ON recurring_journal_templates FOR ALL
  USING (auth.uid() = created_by OR is_admin(auth.uid()));

-- Transaction Mapping policies
CREATE POLICY "Users can view GL mappings"
  ON transaction_to_gl_mapping FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Admins can manage GL mappings"
  ON transaction_to_gl_mapping FOR ALL
  USING (is_admin(auth.uid()));