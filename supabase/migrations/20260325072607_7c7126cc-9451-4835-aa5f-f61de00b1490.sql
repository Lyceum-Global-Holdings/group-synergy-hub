-- Fix get_profit_loss_report: parent_id → parent_account_id
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
      coa.parent_account_id,
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
    ah.parent_account_id as parent_id,
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

-- Fix get_balance_sheet: parent_id → parent_account_id
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

  v_retained_earnings := -v_retained_earnings;

  RETURN QUERY
  WITH account_balances AS (
    SELECT 
      coa.id,
      coa.account_code,
      coa.account_name,
      coa.account_type,
      coa.parent_account_id,
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
    GROUP BY coa.id, coa.account_code, coa.account_name, coa.account_type, coa.parent_account_id, coa.level
  )
  SELECT 
    ab.id,
    ab.account_code,
    ab.account_name,
    ab.account_type,
    ab.parent_account_id as parent_id,
    ab.level_depth,
    ab.balance,
    ab.category
  FROM account_balances ab
  
  UNION ALL
  
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