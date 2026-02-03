-- =====================================================
-- PHASE 3: BANK & RECONCILIATION INFRASTRUCTURE
-- Statement Import, Auto-Matching, Reconciliation Sessions
-- =====================================================

-- ===========================================
-- 1. BANK STATEMENT IMPORTS TABLE
-- ===========================================

CREATE TABLE IF NOT EXISTS public.bank_statement_imports (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE,
  bank_account_id UUID NOT NULL REFERENCES public.bank_accounts(id),
  file_name TEXT NOT NULL,
  file_format TEXT CHECK (file_format IN ('csv', 'ofx', 'qfx', 'mt940', 'camt053', 'manual')),
  import_date TIMESTAMPTZ DEFAULT now(),
  statement_date DATE,
  period_start DATE,
  period_end DATE,
  opening_balance NUMERIC(15,2),
  closing_balance NUMERIC(15,2),
  total_debits NUMERIC(15,2) DEFAULT 0,
  total_credits NUMERIC(15,2) DEFAULT 0,
  transaction_count INT DEFAULT 0,
  matched_count INT DEFAULT 0,
  unmatched_count INT DEFAULT 0,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'processed', 'reconciled', 'error')),
  error_message TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  created_by UUID
);

ALTER TABLE public.bank_statement_imports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view company bank statement imports"
ON public.bank_statement_imports FOR SELECT TO authenticated
USING (can_access_company(company_id) OR company_id IS NULL);

CREATE POLICY "Users can manage company bank statement imports"
ON public.bank_statement_imports FOR ALL TO authenticated
USING (can_access_company(company_id))
WITH CHECK (can_access_company(company_id));

-- ===========================================
-- 2. BANK STATEMENT LINES TABLE
-- ===========================================

CREATE TABLE IF NOT EXISTS public.bank_statement_lines (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  import_id UUID NOT NULL REFERENCES public.bank_statement_imports(id) ON DELETE CASCADE,
  line_number INT NOT NULL,
  transaction_date DATE NOT NULL,
  value_date DATE,
  description TEXT,
  reference TEXT,
  check_number TEXT,
  debit_amount NUMERIC(15,2),
  credit_amount NUMERIC(15,2),
  running_balance NUMERIC(15,2),
  transaction_type TEXT,
  payee_name TEXT,
  
  -- Matching fields
  matched_transaction_id UUID REFERENCES public.bank_transactions(id),
  match_status TEXT DEFAULT 'unmatched' CHECK (match_status IN ('unmatched', 'suggested', 'matched', 'manual', 'ignored')),
  match_confidence NUMERIC(5,2),
  match_reason TEXT,
  matched_by UUID,
  matched_at TIMESTAMPTZ,
  
  -- For creating new transactions from unmatched lines
  create_transaction BOOLEAN DEFAULT false,
  gl_account_id UUID REFERENCES public.chart_of_accounts(id),
  
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.bank_statement_lines ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view bank statement lines"
ON public.bank_statement_lines FOR SELECT TO authenticated
USING (EXISTS (
  SELECT 1 FROM bank_statement_imports bsi 
  WHERE bsi.id = import_id 
  AND can_access_company(bsi.company_id)
));

CREATE POLICY "Users can manage bank statement lines"
ON public.bank_statement_lines FOR ALL TO authenticated
USING (EXISTS (
  SELECT 1 FROM bank_statement_imports bsi 
  WHERE bsi.id = import_id 
  AND can_access_company(bsi.company_id)
));

-- ===========================================
-- 3. BANK RECONCILIATION SESSIONS TABLE
-- ===========================================

CREATE TABLE IF NOT EXISTS public.bank_reconciliation_sessions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE,
  bank_account_id UUID NOT NULL REFERENCES public.bank_accounts(id),
  statement_import_id UUID REFERENCES public.bank_statement_imports(id),
  
  -- Period
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  
  -- Balances
  opening_book_balance NUMERIC(15,2) NOT NULL,
  closing_book_balance NUMERIC(15,2) NOT NULL,
  statement_balance NUMERIC(15,2) NOT NULL,
  reconciled_balance NUMERIC(15,2),
  difference NUMERIC(15,2),
  
  -- Outstanding items
  outstanding_deposits INT DEFAULT 0,
  outstanding_deposits_amount NUMERIC(15,2) DEFAULT 0,
  outstanding_checks INT DEFAULT 0,
  outstanding_checks_amount NUMERIC(15,2) DEFAULT 0,
  
  -- Status
  status TEXT DEFAULT 'in_progress' CHECK (status IN ('in_progress', 'completed', 'approved', 'rejected')),
  completed_by UUID,
  completed_at TIMESTAMPTZ,
  approved_by UUID,
  approved_at TIMESTAMPTZ,
  
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  created_by UUID
);

ALTER TABLE public.bank_reconciliation_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view company reconciliation sessions"
ON public.bank_reconciliation_sessions FOR SELECT TO authenticated
USING (can_access_company(company_id) OR company_id IS NULL);

CREATE POLICY "Users can manage company reconciliation sessions"
ON public.bank_reconciliation_sessions FOR ALL TO authenticated
USING (can_access_company(company_id))
WITH CHECK (can_access_company(company_id));

-- ===========================================
-- 4. RECONCILIATION ITEMS TABLE
-- ===========================================

CREATE TABLE IF NOT EXISTS public.reconciliation_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  reconciliation_id UUID NOT NULL REFERENCES public.bank_reconciliation_sessions(id) ON DELETE CASCADE,
  item_type TEXT NOT NULL CHECK (item_type IN ('deposit', 'check', 'adjustment', 'bank_charge', 'interest')),
  transaction_id UUID REFERENCES public.bank_transactions(id),
  statement_line_id UUID REFERENCES public.bank_statement_lines(id),
  transaction_date DATE NOT NULL,
  description TEXT,
  reference TEXT,
  amount NUMERIC(15,2) NOT NULL,
  is_reconciled BOOLEAN DEFAULT false,
  reconciled_at TIMESTAMPTZ,
  reconciled_by UUID,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.reconciliation_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view reconciliation items"
ON public.reconciliation_items FOR SELECT TO authenticated
USING (EXISTS (
  SELECT 1 FROM bank_reconciliation_sessions brs 
  WHERE brs.id = reconciliation_id 
  AND can_access_company(brs.company_id)
));

CREATE POLICY "Users can manage reconciliation items"
ON public.reconciliation_items FOR ALL TO authenticated
USING (EXISTS (
  SELECT 1 FROM bank_reconciliation_sessions brs 
  WHERE brs.id = reconciliation_id 
  AND can_access_company(brs.company_id)
));

-- ===========================================
-- 5. BANK MATCHING FUNCTION
-- ===========================================

CREATE OR REPLACE FUNCTION public.match_bank_transactions(
  p_import_id UUID
)
RETURNS TABLE (
  statement_line_id UUID,
  matched_transaction_id UUID,
  confidence_score NUMERIC,
  match_reason TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_bank_account_id UUID;
  v_company_id UUID;
BEGIN
  -- Get bank account and company from import
  SELECT bsi.bank_account_id, bsi.company_id 
  INTO v_bank_account_id, v_company_id
  FROM bank_statement_imports bsi
  WHERE bsi.id = p_import_id;

  RETURN QUERY
  WITH potential_matches AS (
    SELECT 
      bsl.id as line_id,
      bt.id as txn_id,
      -- Exact amount match: 40 points
      CASE 
        WHEN (bsl.debit_amount IS NOT NULL AND bt.debit_amount = bsl.debit_amount) OR
             (bsl.credit_amount IS NOT NULL AND bt.credit_amount = bsl.credit_amount)
        THEN 40
        ELSE 0
      END +
      -- Same date: 30 points, within 3 days: 20 points, within 7 days: 10 points
      CASE 
        WHEN bt.transaction_date = bsl.transaction_date THEN 30
        WHEN ABS(bt.transaction_date - bsl.transaction_date) <= 3 THEN 20
        WHEN ABS(bt.transaction_date - bsl.transaction_date) <= 7 THEN 10
        ELSE 0
      END +
      -- Reference match: 20 points
      CASE 
        WHEN bt.reference_number IS NOT NULL AND bsl.reference IS NOT NULL 
             AND bt.reference_number = bsl.reference THEN 20
        WHEN bt.reference_number IS NOT NULL AND bsl.reference IS NOT NULL 
             AND (bt.reference_number ILIKE '%' || bsl.reference || '%' OR 
                  bsl.reference ILIKE '%' || bt.reference_number || '%') THEN 10
        ELSE 0
      END +
      -- Check number match: 10 points
      CASE 
        WHEN bsl.check_number IS NOT NULL AND bt.reference_number = bsl.check_number THEN 10
        ELSE 0
      END as confidence,
      CASE 
        WHEN (bsl.debit_amount IS NOT NULL AND bt.debit_amount = bsl.debit_amount) OR
             (bsl.credit_amount IS NOT NULL AND bt.credit_amount = bsl.credit_amount)
        THEN 'Amount matched'
        ELSE 'Partial match'
      END ||
      CASE WHEN bt.transaction_date = bsl.transaction_date THEN ', Same date' ELSE '' END ||
      CASE WHEN bt.reference_number IS NOT NULL AND bsl.reference IS NOT NULL 
                AND bt.reference_number = bsl.reference THEN ', Reference matched' ELSE '' END
      as reason
    FROM bank_statement_lines bsl
    CROSS JOIN bank_transactions bt
    WHERE bsl.import_id = p_import_id
      AND bsl.match_status = 'unmatched'
      AND bt.bank_account_id = v_bank_account_id
      AND bt.is_reconciled = false
      -- Amount must match (either debit or credit)
      AND (
        (bsl.debit_amount IS NOT NULL AND bt.debit_amount = bsl.debit_amount) OR
        (bsl.credit_amount IS NOT NULL AND bt.credit_amount = bsl.credit_amount)
      )
      -- Date must be within 30 days
      AND ABS(bt.transaction_date - bsl.transaction_date) <= 30
  )
  SELECT 
    pm.line_id,
    pm.txn_id,
    pm.confidence::NUMERIC,
    pm.reason
  FROM potential_matches pm
  WHERE pm.confidence >= 50  -- Minimum confidence threshold
  ORDER BY pm.confidence DESC;
END;
$$;

GRANT EXECUTE ON FUNCTION public.match_bank_transactions TO authenticated;

-- ===========================================
-- 6. INDEXES FOR PERFORMANCE
-- ===========================================

CREATE INDEX IF NOT EXISTS idx_bank_statement_imports_account ON public.bank_statement_imports(bank_account_id);
CREATE INDEX IF NOT EXISTS idx_bank_statement_imports_status ON public.bank_statement_imports(status);
CREATE INDEX IF NOT EXISTS idx_bank_statement_lines_import ON public.bank_statement_lines(import_id);
CREATE INDEX IF NOT EXISTS idx_bank_statement_lines_match_status ON public.bank_statement_lines(match_status);
CREATE INDEX IF NOT EXISTS idx_bank_statement_lines_date ON public.bank_statement_lines(transaction_date);
CREATE INDEX IF NOT EXISTS idx_reconciliation_sessions_account ON public.bank_reconciliation_sessions(bank_account_id);
CREATE INDEX IF NOT EXISTS idx_reconciliation_sessions_status ON public.bank_reconciliation_sessions(status);
CREATE INDEX IF NOT EXISTS idx_reconciliation_items_session ON public.reconciliation_items(reconciliation_id);

COMMENT ON TABLE public.bank_statement_imports IS 'Bank statement file imports for reconciliation';
COMMENT ON TABLE public.bank_statement_lines IS 'Individual transactions from bank statement imports';
COMMENT ON TABLE public.bank_reconciliation_sessions IS 'Bank reconciliation sessions with period tracking';
COMMENT ON FUNCTION public.match_bank_transactions IS 'Auto-matches bank statement lines with book transactions using confidence scoring';