-- =====================================================
-- PHASE 1: FINANCIAL STATEMENTS INFRASTRUCTURE
-- ERPNext-Inspired Accounting System (Fixed)
-- =====================================================

-- ===========================================
-- 1. CASH FLOW MAPPINGS TABLE
-- ===========================================

CREATE TABLE IF NOT EXISTS public.cash_flow_mappings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE,
  account_id UUID REFERENCES public.chart_of_accounts(id) ON DELETE CASCADE,
  cash_flow_category TEXT NOT NULL CHECK (cash_flow_category IN ('operating', 'investing', 'financing')),
  activity_type TEXT NOT NULL,
  description TEXT,
  is_addition BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  created_by UUID,
  UNIQUE(company_id, account_id)
);

ALTER TABLE public.cash_flow_mappings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view company cash flow mappings"
ON public.cash_flow_mappings FOR SELECT TO authenticated
USING (can_access_company(company_id) OR company_id IS NULL);

CREATE POLICY "Users can manage company cash flow mappings"
ON public.cash_flow_mappings FOR ALL TO authenticated
USING (can_access_company(company_id))
WITH CHECK (can_access_company(company_id));

-- ===========================================
-- 2. GET PROFIT & LOSS REPORT FUNCTION
-- ===========================================

CREATE OR REPLACE FUNCTION public.get_profit_loss_report(
  p_company_id UUID,
  p_start_date DATE,
  p_end_date DATE,
  p_comparison_start DATE DEFAULT NULL,
  p_comparison_end DATE DEFAULT NULL
)
RETURNS TABLE (
  account_id UUID,
  account_code TEXT,
  account_name TEXT,
  account_type TEXT,
  parent_id UUID,
  level_depth INT,
  current_period_amount NUMERIC,
  comparison_period_amount NUMERIC,
  variance_amount NUMERIC,
  variance_percent NUMERIC
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  WITH account_hierarchy AS (
    SELECT 
      coa.id,
      coa.account_code,
      coa.account_name,
      coa.account_type,
      coa.parent_id,
      coa.level as level_depth
    FROM chart_of_accounts coa
    WHERE coa.company_id = p_company_id
      AND coa.account_type IN ('Revenue', 'Expense', 'Income', 'Cost of Goods Sold')
      AND coa.is_active = true
  ),
  current_period_balances AS (
    SELECT 
      jel.account_id,
      CASE 
        WHEN ah.account_type IN ('Revenue', 'Income') THEN 
          COALESCE(SUM(jel.credit_amount), 0) - COALESCE(SUM(jel.debit_amount), 0)
        ELSE 
          COALESCE(SUM(jel.debit_amount), 0) - COALESCE(SUM(jel.credit_amount), 0)
      END as balance
    FROM journal_entry_lines jel
    INNER JOIN journal_entries je ON je.id = jel.journal_entry_id
    INNER JOIN account_hierarchy ah ON ah.id = jel.account_id
    WHERE je.company_id = p_company_id
      AND je.status = 'posted'
      AND je.journal_date BETWEEN p_start_date AND p_end_date
    GROUP BY jel.account_id, ah.account_type
  ),
  comparison_period_balances AS (
    SELECT 
      jel.account_id,
      CASE 
        WHEN ah.account_type IN ('Revenue', 'Income') THEN 
          COALESCE(SUM(jel.credit_amount), 0) - COALESCE(SUM(jel.debit_amount), 0)
        ELSE 
          COALESCE(SUM(jel.debit_amount), 0) - COALESCE(SUM(jel.credit_amount), 0)
      END as balance
    FROM journal_entry_lines jel
    INNER JOIN journal_entries je ON je.id = jel.journal_entry_id
    INNER JOIN account_hierarchy ah ON ah.id = jel.account_id
    WHERE je.company_id = p_company_id
      AND je.status = 'posted'
      AND p_comparison_start IS NOT NULL
      AND p_comparison_end IS NOT NULL
      AND je.journal_date BETWEEN p_comparison_start AND p_comparison_end
    GROUP BY jel.account_id, ah.account_type
  )
  SELECT 
    ah.id as account_id,
    ah.account_code,
    ah.account_name,
    ah.account_type,
    ah.parent_id,
    ah.level_depth,
    COALESCE(cpb.balance, 0) as current_period_amount,
    COALESCE(compb.balance, 0) as comparison_period_amount,
    COALESCE(cpb.balance, 0) - COALESCE(compb.balance, 0) as variance_amount,
    CASE 
      WHEN COALESCE(compb.balance, 0) = 0 THEN 0
      ELSE ROUND(((COALESCE(cpb.balance, 0) - COALESCE(compb.balance, 0)) / ABS(compb.balance)) * 100, 2)
    END as variance_percent
  FROM account_hierarchy ah
  LEFT JOIN current_period_balances cpb ON cpb.account_id = ah.id
  LEFT JOIN comparison_period_balances compb ON compb.account_id = ah.id
  ORDER BY ah.account_type, ah.account_code;
END;
$$;

-- ===========================================
-- 3. GET BALANCE SHEET FUNCTION
-- ===========================================

CREATE OR REPLACE FUNCTION public.get_balance_sheet(
  p_company_id UUID,
  p_as_of_date DATE
)
RETURNS TABLE (
  account_id UUID,
  account_code TEXT,
  account_name TEXT,
  account_type TEXT,
  parent_id UUID,
  level_depth INT,
  balance NUMERIC,
  category TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_retained_earnings NUMERIC;
BEGIN
  -- Calculate retained earnings (all historical P&L up to as_of_date)
  SELECT 
    COALESCE(SUM(
      CASE 
        WHEN coa.account_type IN ('Revenue', 'Income') THEN 
          COALESCE(jel.credit_amount, 0) - COALESCE(jel.debit_amount, 0)
        WHEN coa.account_type IN ('Expense', 'Cost of Goods Sold') THEN
          COALESCE(jel.debit_amount, 0) - COALESCE(jel.credit_amount, 0)
        ELSE 0
      END
    ), 0)
  INTO v_retained_earnings
  FROM journal_entry_lines jel
  INNER JOIN journal_entries je ON je.id = jel.journal_entry_id
  INNER JOIN chart_of_accounts coa ON coa.id = jel.account_id
  WHERE je.company_id = p_company_id
    AND je.status = 'posted'
    AND je.journal_date <= p_as_of_date
    AND coa.account_type IN ('Revenue', 'Income', 'Expense', 'Cost of Goods Sold');

  -- Net income reduces retained earnings for expenses
  v_retained_earnings := -v_retained_earnings;

  RETURN QUERY
  WITH account_balances AS (
    SELECT 
      coa.id,
      coa.account_code,
      coa.account_name,
      coa.account_type,
      coa.parent_id,
      coa.level as level_depth,
      CASE 
        WHEN coa.account_type IN ('Asset', 'Fixed Asset', 'Bank', 'Cash', 'Receivable') THEN 
          COALESCE(SUM(jel.debit_amount), 0) - COALESCE(SUM(jel.credit_amount), 0)
        WHEN coa.account_type IN ('Liability', 'Payable', 'Equity') THEN
          COALESCE(SUM(jel.credit_amount), 0) - COALESCE(SUM(jel.debit_amount), 0)
        ELSE 0
      END as balance,
      CASE 
        WHEN coa.account_type IN ('Asset', 'Fixed Asset', 'Bank', 'Cash', 'Receivable') THEN 'Assets'
        WHEN coa.account_type IN ('Liability', 'Payable') THEN 'Liabilities'
        WHEN coa.account_type = 'Equity' THEN 'Equity'
        ELSE 'Other'
      END as category
    FROM chart_of_accounts coa
    LEFT JOIN journal_entry_lines jel ON jel.account_id = coa.id
    LEFT JOIN journal_entries je ON je.id = jel.journal_entry_id 
      AND je.status = 'posted' 
      AND je.journal_date <= p_as_of_date
    WHERE coa.company_id = p_company_id
      AND coa.account_type IN ('Asset', 'Fixed Asset', 'Bank', 'Cash', 'Receivable', 'Liability', 'Payable', 'Equity')
      AND coa.is_active = true
    GROUP BY coa.id, coa.account_code, coa.account_name, coa.account_type, coa.parent_id, coa.level
  )
  SELECT 
    ab.id,
    ab.account_code,
    ab.account_name,
    ab.account_type,
    ab.parent_id,
    ab.level_depth,
    ab.balance,
    ab.category
  FROM account_balances ab
  
  UNION ALL
  
  -- Add Retained Earnings as a virtual row
  SELECT 
    NULL::UUID as id,
    'RE' as account_code,
    'Retained Earnings' as account_name,
    'Equity' as account_type,
    NULL::UUID as parent_id,
    1 as level_depth,
    v_retained_earnings as balance,
    'Equity' as category
  
  ORDER BY category, account_code;
END;
$$;

-- ===========================================
-- 4. GET CASH FLOW STATEMENT FUNCTION
-- ===========================================

CREATE OR REPLACE FUNCTION public.get_cash_flow_statement(
  p_company_id UUID,
  p_start_date DATE,
  p_end_date DATE
)
RETURNS TABLE (
  category TEXT,
  activity_type TEXT,
  account_name TEXT,
  amount NUMERIC,
  is_subtotal BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_net_income NUMERIC;
BEGIN
  -- Calculate Net Income (starting point for indirect method)
  SELECT 
    COALESCE(SUM(
      CASE 
        WHEN coa.account_type IN ('Revenue', 'Income') THEN 
          COALESCE(jel.credit_amount, 0) - COALESCE(jel.debit_amount, 0)
        WHEN coa.account_type IN ('Expense', 'Cost of Goods Sold') THEN
          -(COALESCE(jel.debit_amount, 0) - COALESCE(jel.credit_amount, 0))
        ELSE 0
      END
    ), 0)
  INTO v_net_income
  FROM journal_entry_lines jel
  INNER JOIN journal_entries je ON je.id = jel.journal_entry_id
  INNER JOIN chart_of_accounts coa ON coa.id = jel.account_id
  WHERE je.company_id = p_company_id
    AND je.status = 'posted'
    AND je.journal_date BETWEEN p_start_date AND p_end_date
    AND coa.account_type IN ('Revenue', 'Income', 'Expense', 'Cost of Goods Sold');

  RETURN QUERY
  -- Net Income row
  SELECT 
    'Operating Activities'::TEXT as category,
    'Net Income'::TEXT as activity_type,
    'Net Income for the Period'::TEXT as account_name,
    v_net_income as amount,
    false as is_subtotal
  
  UNION ALL
  
  -- Operating activities from mappings
  SELECT 
    'Operating Activities'::TEXT,
    cfm.activity_type,
    coa.account_name,
    CASE 
      WHEN cfm.is_addition THEN 
        COALESCE(SUM(jel.debit_amount), 0) - COALESCE(SUM(jel.credit_amount), 0)
      ELSE
        COALESCE(SUM(jel.credit_amount), 0) - COALESCE(SUM(jel.debit_amount), 0)
    END as amount,
    false
  FROM cash_flow_mappings cfm
  INNER JOIN chart_of_accounts coa ON coa.id = cfm.account_id
  LEFT JOIN journal_entry_lines jel ON jel.account_id = cfm.account_id
  LEFT JOIN journal_entries je ON je.id = jel.journal_entry_id
    AND je.status = 'posted'
    AND je.journal_date BETWEEN p_start_date AND p_end_date
  WHERE cfm.company_id = p_company_id
    AND cfm.cash_flow_category = 'operating'
  GROUP BY cfm.activity_type, coa.account_name, cfm.is_addition
  
  UNION ALL
  
  -- Investing activities
  SELECT 
    'Investing Activities'::TEXT,
    cfm.activity_type,
    coa.account_name,
    CASE 
      WHEN cfm.is_addition THEN 
        COALESCE(SUM(jel.debit_amount), 0) - COALESCE(SUM(jel.credit_amount), 0)
      ELSE
        COALESCE(SUM(jel.credit_amount), 0) - COALESCE(SUM(jel.debit_amount), 0)
    END as amount,
    false
  FROM cash_flow_mappings cfm
  INNER JOIN chart_of_accounts coa ON coa.id = cfm.account_id
  LEFT JOIN journal_entry_lines jel ON jel.account_id = cfm.account_id
  LEFT JOIN journal_entries je ON je.id = jel.journal_entry_id
    AND je.status = 'posted'
    AND je.journal_date BETWEEN p_start_date AND p_end_date
  WHERE cfm.company_id = p_company_id
    AND cfm.cash_flow_category = 'investing'
  GROUP BY cfm.activity_type, coa.account_name, cfm.is_addition
  
  UNION ALL
  
  -- Financing activities
  SELECT 
    'Financing Activities'::TEXT,
    cfm.activity_type,
    coa.account_name,
    CASE 
      WHEN cfm.is_addition THEN 
        COALESCE(SUM(jel.debit_amount), 0) - COALESCE(SUM(jel.credit_amount), 0)
      ELSE
        COALESCE(SUM(jel.credit_amount), 0) - COALESCE(SUM(jel.debit_amount), 0)
    END as amount,
    false
  FROM cash_flow_mappings cfm
  INNER JOIN chart_of_accounts coa ON coa.id = cfm.account_id
  LEFT JOIN journal_entry_lines jel ON jel.account_id = cfm.account_id
  LEFT JOIN journal_entries je ON je.id = jel.journal_entry_id
    AND je.status = 'posted'
    AND je.journal_date BETWEEN p_start_date AND p_end_date
  WHERE cfm.company_id = p_company_id
    AND cfm.cash_flow_category = 'financing'
  GROUP BY cfm.activity_type, coa.account_name, cfm.is_addition
  
  ORDER BY category, activity_type;
END;
$$;

-- ===========================================
-- 5. CALCULATE AGING BUCKETS FUNCTION
-- ===========================================

CREATE OR REPLACE FUNCTION public.calculate_aging_buckets(
  p_company_id UUID,
  p_as_of_date DATE,
  p_invoice_type TEXT -- 'customer' or 'supplier'
)
RETURNS TABLE (
  entity_id UUID,
  entity_name TEXT,
  current_bucket NUMERIC,
  bucket_1_30 NUMERIC,
  bucket_31_60 NUMERIC,
  bucket_61_90 NUMERIC,
  bucket_over_90 NUMERIC,
  total_outstanding NUMERIC
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_invoice_type = 'customer' THEN
    RETURN QUERY
    SELECT 
      c.id as entity_id,
      c.name as entity_name,
      COALESCE(SUM(CASE WHEN (p_as_of_date - ci.due_date) <= 0 THEN (ci.net_amount - COALESCE(ci.amount_received, 0)) ELSE 0 END), 0) as current_bucket,
      COALESCE(SUM(CASE WHEN (p_as_of_date - ci.due_date) BETWEEN 1 AND 30 THEN (ci.net_amount - COALESCE(ci.amount_received, 0)) ELSE 0 END), 0) as bucket_1_30,
      COALESCE(SUM(CASE WHEN (p_as_of_date - ci.due_date) BETWEEN 31 AND 60 THEN (ci.net_amount - COALESCE(ci.amount_received, 0)) ELSE 0 END), 0) as bucket_31_60,
      COALESCE(SUM(CASE WHEN (p_as_of_date - ci.due_date) BETWEEN 61 AND 90 THEN (ci.net_amount - COALESCE(ci.amount_received, 0)) ELSE 0 END), 0) as bucket_61_90,
      COALESCE(SUM(CASE WHEN (p_as_of_date - ci.due_date) > 90 THEN (ci.net_amount - COALESCE(ci.amount_received, 0)) ELSE 0 END), 0) as bucket_over_90,
      COALESCE(SUM(ci.net_amount - COALESCE(ci.amount_received, 0)), 0) as total_outstanding
    FROM customers c
    LEFT JOIN customer_invoices ci ON ci.customer_id = c.id 
      AND ci.status IN ('sent', 'overdue', 'partial')
      AND ci.company_id = p_company_id
    WHERE c.company_id = p_company_id
    GROUP BY c.id, c.name
    HAVING COALESCE(SUM(ci.net_amount - COALESCE(ci.amount_received, 0)), 0) > 0
    ORDER BY total_outstanding DESC;
  ELSE
    RETURN QUERY
    SELECT 
      s.id as entity_id,
      s.name as entity_name,
      COALESCE(SUM(CASE WHEN (p_as_of_date - si.due_date) <= 0 THEN (si.net_amount - COALESCE(si.amount_paid, 0)) ELSE 0 END), 0) as current_bucket,
      COALESCE(SUM(CASE WHEN (p_as_of_date - si.due_date) BETWEEN 1 AND 30 THEN (si.net_amount - COALESCE(si.amount_paid, 0)) ELSE 0 END), 0) as bucket_1_30,
      COALESCE(SUM(CASE WHEN (p_as_of_date - si.due_date) BETWEEN 31 AND 60 THEN (si.net_amount - COALESCE(si.amount_paid, 0)) ELSE 0 END), 0) as bucket_31_60,
      COALESCE(SUM(CASE WHEN (p_as_of_date - si.due_date) BETWEEN 61 AND 90 THEN (si.net_amount - COALESCE(si.amount_paid, 0)) ELSE 0 END), 0) as bucket_61_90,
      COALESCE(SUM(CASE WHEN (p_as_of_date - si.due_date) > 90 THEN (si.net_amount - COALESCE(si.amount_paid, 0)) ELSE 0 END), 0) as bucket_over_90,
      COALESCE(SUM(si.net_amount - COALESCE(si.amount_paid, 0)), 0) as total_outstanding
    FROM suppliers s
    LEFT JOIN supplier_invoices si ON si.supplier_id = s.id 
      AND si.status IN ('pending', 'approved', 'partial')
      AND si.company_id = p_company_id
    WHERE s.company_id = p_company_id
    GROUP BY s.id, s.name
    HAVING COALESCE(SUM(si.net_amount - COALESCE(si.amount_paid, 0)), 0) > 0
    ORDER BY total_outstanding DESC;
  END IF;
END;
$$;

-- ===========================================
-- 6. INDEXES FOR PERFORMANCE
-- ===========================================

CREATE INDEX IF NOT EXISTS idx_cash_flow_mappings_company ON public.cash_flow_mappings(company_id);
CREATE INDEX IF NOT EXISTS idx_cash_flow_mappings_account ON public.cash_flow_mappings(account_id);
CREATE INDEX IF NOT EXISTS idx_journal_entries_date_status ON public.journal_entries(journal_date, status) WHERE status = 'posted';
CREATE INDEX IF NOT EXISTS idx_journal_entry_lines_account ON public.journal_entry_lines(account_id);

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION public.get_profit_loss_report TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_balance_sheet TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_cash_flow_statement TO authenticated;
GRANT EXECUTE ON FUNCTION public.calculate_aging_buckets TO authenticated;

COMMENT ON FUNCTION public.get_profit_loss_report IS 'Generates P&L report with optional comparison period';
COMMENT ON FUNCTION public.get_balance_sheet IS 'Generates Balance Sheet as of a specific date with calculated retained earnings';
COMMENT ON FUNCTION public.get_cash_flow_statement IS 'Generates Cash Flow Statement using indirect method';
COMMENT ON FUNCTION public.calculate_aging_buckets IS 'Calculates AR/AP aging in 30-day buckets';