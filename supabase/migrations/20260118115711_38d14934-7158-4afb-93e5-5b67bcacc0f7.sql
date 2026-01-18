-- =============================================
-- SAP FICO Finance Module - Core Database Schema
-- =============================================

-- =============================================
-- ACCOUNTS PAYABLE (FI-AP) Tables
-- =============================================

-- Supplier Invoices
CREATE TABLE IF NOT EXISTS supplier_invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_number TEXT NOT NULL,
  supplier_id UUID REFERENCES suppliers(id),
  invoice_date DATE NOT NULL,
  due_date DATE NOT NULL,
  gross_amount NUMERIC(18,2) NOT NULL DEFAULT 0,
  tax_amount NUMERIC(18,2) DEFAULT 0,
  net_amount NUMERIC(18,2) NOT NULL DEFAULT 0,
  amount_paid NUMERIC(18,2) DEFAULT 0,
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'pending_approval', 'approved', 'posted', 'partially_paid', 'paid', 'cancelled')),
  payment_terms TEXT,
  currency TEXT DEFAULT 'LKR',
  exchange_rate NUMERIC(10,4) DEFAULT 1,
  gl_account_id UUID REFERENCES chart_of_accounts(id),
  po_id UUID REFERENCES purchase_orders(id),
  grn_id UUID,
  three_way_match_status TEXT DEFAULT 'pending' CHECK (three_way_match_status IN ('pending', 'matched', 'partial', 'mismatch')),
  notes TEXT,
  company_id UUID REFERENCES companies(id),
  created_by UUID,
  posted_by UUID,
  posted_date TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Invoice Line Items
CREATE TABLE IF NOT EXISTS supplier_invoice_lines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id UUID REFERENCES supplier_invoices(id) ON DELETE CASCADE,
  line_number INTEGER NOT NULL,
  description TEXT,
  quantity NUMERIC(18,4) DEFAULT 1,
  unit_price NUMERIC(18,4) NOT NULL DEFAULT 0,
  amount NUMERIC(18,2) NOT NULL DEFAULT 0,
  gl_account_id UUID REFERENCES chart_of_accounts(id),
  cost_center_id UUID REFERENCES cost_centers(id),
  tax_code_id UUID REFERENCES tax_codes(id),
  tax_amount NUMERIC(18,2) DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Supplier Payments
CREATE TABLE IF NOT EXISTS supplier_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_number TEXT NOT NULL,
  payment_date DATE NOT NULL,
  supplier_id UUID REFERENCES suppliers(id),
  bank_account_id UUID,
  payment_method TEXT CHECK (payment_method IN ('check', 'wire', 'ach', 'cash', 'online')),
  total_amount NUMERIC(18,2) NOT NULL DEFAULT 0,
  reference_number TEXT,
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'pending', 'approved', 'posted', 'cancelled')),
  journal_entry_id UUID REFERENCES journal_entries(id),
  notes TEXT,
  company_id UUID REFERENCES companies(id),
  created_by UUID,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Payment Allocations (link payments to invoices)
CREATE TABLE IF NOT EXISTS payment_allocations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_id UUID REFERENCES supplier_payments(id) ON DELETE CASCADE,
  invoice_id UUID REFERENCES supplier_invoices(id),
  amount_allocated NUMERIC(18,2) NOT NULL,
  discount_taken NUMERIC(18,2) DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- ACCOUNTS RECEIVABLE (FI-AR) Tables
-- =============================================

-- Customers
CREATE TABLE IF NOT EXISTS customers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_code TEXT NOT NULL,
  customer_name TEXT NOT NULL,
  contact_person TEXT,
  email TEXT,
  phone TEXT,
  address TEXT,
  city TEXT,
  country TEXT,
  tax_id TEXT,
  payment_terms TEXT DEFAULT 'Net 30',
  credit_limit NUMERIC(18,2) DEFAULT 0,
  current_balance NUMERIC(18,2) DEFAULT 0,
  gl_account_id UUID REFERENCES chart_of_accounts(id),
  is_active BOOLEAN DEFAULT true,
  company_id UUID REFERENCES companies(id),
  created_by UUID,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Customer Invoices
CREATE TABLE IF NOT EXISTS customer_invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_number TEXT NOT NULL,
  customer_id UUID REFERENCES customers(id),
  invoice_date DATE NOT NULL,
  due_date DATE NOT NULL,
  gross_amount NUMERIC(18,2) NOT NULL DEFAULT 0,
  tax_amount NUMERIC(18,2) DEFAULT 0,
  net_amount NUMERIC(18,2) NOT NULL DEFAULT 0,
  amount_received NUMERIC(18,2) DEFAULT 0,
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'pending', 'posted', 'partially_paid', 'paid', 'cancelled', 'written_off')),
  payment_terms TEXT,
  currency TEXT DEFAULT 'LKR',
  sales_order_id UUID,
  gl_account_id UUID REFERENCES chart_of_accounts(id),
  notes TEXT,
  company_id UUID REFERENCES companies(id),
  created_by UUID,
  posted_by UUID,
  posted_date TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Customer Invoice Lines
CREATE TABLE IF NOT EXISTS customer_invoice_lines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id UUID REFERENCES customer_invoices(id) ON DELETE CASCADE,
  line_number INTEGER NOT NULL,
  description TEXT,
  quantity NUMERIC(18,4) DEFAULT 1,
  unit_price NUMERIC(18,4) NOT NULL DEFAULT 0,
  amount NUMERIC(18,2) NOT NULL DEFAULT 0,
  gl_account_id UUID REFERENCES chart_of_accounts(id),
  tax_code_id UUID REFERENCES tax_codes(id),
  tax_amount NUMERIC(18,2) DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Customer Receipts
CREATE TABLE IF NOT EXISTS customer_receipts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  receipt_number TEXT NOT NULL,
  receipt_date DATE NOT NULL,
  customer_id UUID REFERENCES customers(id),
  bank_account_id UUID,
  payment_method TEXT CHECK (payment_method IN ('check', 'wire', 'ach', 'cash', 'online', 'card')),
  total_amount NUMERIC(18,2) NOT NULL DEFAULT 0,
  reference_number TEXT,
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'posted', 'cancelled')),
  journal_entry_id UUID REFERENCES journal_entries(id),
  notes TEXT,
  company_id UUID REFERENCES companies(id),
  created_by UUID,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Receipt Allocations
CREATE TABLE IF NOT EXISTS receipt_allocations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  receipt_id UUID REFERENCES customer_receipts(id) ON DELETE CASCADE,
  invoice_id UUID REFERENCES customer_invoices(id),
  amount_allocated NUMERIC(18,2) NOT NULL,
  discount_given NUMERIC(18,2) DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- CASH & BANK (FI-BL) Tables
-- =============================================

-- Bank Accounts
CREATE TABLE IF NOT EXISTS bank_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_name TEXT NOT NULL,
  account_number TEXT NOT NULL,
  bank_name TEXT NOT NULL,
  branch_name TEXT,
  swift_code TEXT,
  iban TEXT,
  currency TEXT DEFAULT 'LKR',
  opening_balance NUMERIC(18,2) DEFAULT 0,
  current_balance NUMERIC(18,2) DEFAULT 0,
  gl_account_id UUID REFERENCES chart_of_accounts(id),
  is_active BOOLEAN DEFAULT true,
  is_default BOOLEAN DEFAULT false,
  company_id UUID REFERENCES companies(id),
  created_by UUID,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Bank Transactions
CREATE TABLE IF NOT EXISTS bank_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bank_account_id UUID REFERENCES bank_accounts(id),
  transaction_date DATE NOT NULL,
  value_date DATE,
  transaction_type TEXT CHECK (transaction_type IN ('deposit', 'withdrawal', 'transfer_in', 'transfer_out', 'fee', 'interest', 'payment', 'receipt')),
  reference_number TEXT,
  description TEXT,
  debit_amount NUMERIC(18,2) DEFAULT 0,
  credit_amount NUMERIC(18,2) DEFAULT 0,
  running_balance NUMERIC(18,2),
  is_reconciled BOOLEAN DEFAULT false,
  reconciled_date DATE,
  reconciliation_id UUID,
  journal_entry_id UUID REFERENCES journal_entries(id),
  source_type TEXT, -- payment, receipt, manual, import
  source_id UUID,
  company_id UUID REFERENCES companies(id),
  created_by UUID,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Bank Statements
CREATE TABLE IF NOT EXISTS bank_statements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bank_account_id UUID REFERENCES bank_accounts(id),
  statement_date DATE NOT NULL,
  statement_number TEXT,
  period_start DATE,
  period_end DATE,
  opening_balance NUMERIC(18,2),
  closing_balance NUMERIC(18,2),
  total_debits NUMERIC(18,2) DEFAULT 0,
  total_credits NUMERIC(18,2) DEFAULT 0,
  file_url TEXT,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'reconciled')),
  company_id UUID REFERENCES companies(id),
  created_by UUID,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Bank Reconciliations
CREATE TABLE IF NOT EXISTS bank_reconciliations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bank_account_id UUID REFERENCES bank_accounts(id),
  reconciliation_date DATE NOT NULL,
  statement_id UUID REFERENCES bank_statements(id),
  statement_balance NUMERIC(18,2) NOT NULL,
  book_balance NUMERIC(18,2) NOT NULL,
  adjusted_book_balance NUMERIC(18,2),
  difference NUMERIC(18,2) DEFAULT 0,
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'in_progress', 'completed')),
  notes TEXT,
  completed_by UUID,
  completed_at TIMESTAMPTZ,
  company_id UUID REFERENCES companies(id),
  created_by UUID,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- FIXED ASSETS (FI-AA) Enhancement
-- =============================================

-- Asset Transactions
CREATE TABLE IF NOT EXISTS asset_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_id UUID REFERENCES asset_master(id),
  transaction_type TEXT CHECK (transaction_type IN ('acquisition', 'depreciation', 'revaluation', 'impairment', 'transfer', 'disposal', 'write_off')),
  transaction_date DATE NOT NULL,
  amount NUMERIC(18,2) NOT NULL,
  journal_entry_id UUID REFERENCES journal_entries(id),
  description TEXT,
  reference_number TEXT,
  company_id UUID REFERENCES companies(id),
  created_by UUID,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Depreciation Schedule
CREATE TABLE IF NOT EXISTS depreciation_schedule (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_id UUID REFERENCES asset_master(id),
  period_id UUID REFERENCES accounting_periods(id),
  fiscal_year INTEGER,
  period_number INTEGER,
  depreciation_amount NUMERIC(18,2) NOT NULL,
  accumulated_depreciation NUMERIC(18,2) NOT NULL,
  book_value NUMERIC(18,2) NOT NULL,
  is_posted BOOLEAN DEFAULT false,
  posted_date DATE,
  journal_entry_id UUID REFERENCES journal_entries(id),
  company_id UUID REFERENCES companies(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- CONTROLLING (CO) - Profit Centers
-- =============================================

CREATE TABLE IF NOT EXISTS profit_centers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  parent_id UUID REFERENCES profit_centers(id),
  manager_id UUID,
  is_active BOOLEAN DEFAULT true,
  company_id UUID REFERENCES companies(id),
  created_by UUID,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- BUDGETING Tables
-- =============================================

-- Budget Headers
CREATE TABLE IF NOT EXISTS budgets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  budget_name TEXT NOT NULL,
  fiscal_year INTEGER NOT NULL,
  budget_type TEXT DEFAULT 'operating' CHECK (budget_type IN ('operating', 'capital', 'project', 'cash')),
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'pending_approval', 'approved', 'active', 'closed')),
  version INTEGER DEFAULT 1,
  total_amount NUMERIC(18,2) DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  notes TEXT,
  approved_by UUID,
  approved_date DATE,
  company_id UUID REFERENCES companies(id),
  created_by UUID,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Budget Lines
CREATE TABLE IF NOT EXISTS budget_lines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  budget_id UUID REFERENCES budgets(id) ON DELETE CASCADE,
  account_id UUID REFERENCES chart_of_accounts(id),
  cost_center_id UUID REFERENCES cost_centers(id),
  profit_center_id UUID REFERENCES profit_centers(id),
  period_1 NUMERIC(18,2) DEFAULT 0,
  period_2 NUMERIC(18,2) DEFAULT 0,
  period_3 NUMERIC(18,2) DEFAULT 0,
  period_4 NUMERIC(18,2) DEFAULT 0,
  period_5 NUMERIC(18,2) DEFAULT 0,
  period_6 NUMERIC(18,2) DEFAULT 0,
  period_7 NUMERIC(18,2) DEFAULT 0,
  period_8 NUMERIC(18,2) DEFAULT 0,
  period_9 NUMERIC(18,2) DEFAULT 0,
  period_10 NUMERIC(18,2) DEFAULT 0,
  period_11 NUMERIC(18,2) DEFAULT 0,
  period_12 NUMERIC(18,2) DEFAULT 0,
  annual_amount NUMERIC(18,2) GENERATED ALWAYS AS (
    period_1 + period_2 + period_3 + period_4 + period_5 + period_6 +
    period_7 + period_8 + period_9 + period_10 + period_11 + period_12
  ) STORED,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- Enable RLS on all new tables
-- =============================================

ALTER TABLE supplier_invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE supplier_invoice_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE supplier_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_allocations ENABLE ROW LEVEL SECURITY;
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE customer_invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE customer_invoice_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE customer_receipts ENABLE ROW LEVEL SECURITY;
ALTER TABLE receipt_allocations ENABLE ROW LEVEL SECURITY;
ALTER TABLE bank_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE bank_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE bank_statements ENABLE ROW LEVEL SECURITY;
ALTER TABLE bank_reconciliations ENABLE ROW LEVEL SECURITY;
ALTER TABLE asset_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE depreciation_schedule ENABLE ROW LEVEL SECURITY;
ALTER TABLE profit_centers ENABLE ROW LEVEL SECURITY;
ALTER TABLE budgets ENABLE ROW LEVEL SECURITY;
ALTER TABLE budget_lines ENABLE ROW LEVEL SECURITY;

-- =============================================
-- RLS Policies - Allow authenticated users to access company data
-- =============================================

-- Supplier Invoices
CREATE POLICY "Users can view supplier invoices" ON supplier_invoices FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users can create supplier invoices" ON supplier_invoices FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Users can update supplier invoices" ON supplier_invoices FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Users can delete supplier invoices" ON supplier_invoices FOR DELETE TO authenticated USING (true);

-- Supplier Invoice Lines
CREATE POLICY "Users can view supplier invoice lines" ON supplier_invoice_lines FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users can create supplier invoice lines" ON supplier_invoice_lines FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Users can update supplier invoice lines" ON supplier_invoice_lines FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Users can delete supplier invoice lines" ON supplier_invoice_lines FOR DELETE TO authenticated USING (true);

-- Supplier Payments
CREATE POLICY "Users can view supplier payments" ON supplier_payments FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users can create supplier payments" ON supplier_payments FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Users can update supplier payments" ON supplier_payments FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Users can delete supplier payments" ON supplier_payments FOR DELETE TO authenticated USING (true);

-- Payment Allocations
CREATE POLICY "Users can view payment allocations" ON payment_allocations FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users can create payment allocations" ON payment_allocations FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Users can update payment allocations" ON payment_allocations FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Users can delete payment allocations" ON payment_allocations FOR DELETE TO authenticated USING (true);

-- Customers
CREATE POLICY "Users can view customers" ON customers FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users can create customers" ON customers FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Users can update customers" ON customers FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Users can delete customers" ON customers FOR DELETE TO authenticated USING (true);

-- Customer Invoices
CREATE POLICY "Users can view customer invoices" ON customer_invoices FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users can create customer invoices" ON customer_invoices FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Users can update customer invoices" ON customer_invoices FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Users can delete customer invoices" ON customer_invoices FOR DELETE TO authenticated USING (true);

-- Customer Invoice Lines
CREATE POLICY "Users can view customer invoice lines" ON customer_invoice_lines FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users can create customer invoice lines" ON customer_invoice_lines FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Users can update customer invoice lines" ON customer_invoice_lines FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Users can delete customer invoice lines" ON customer_invoice_lines FOR DELETE TO authenticated USING (true);

-- Customer Receipts
CREATE POLICY "Users can view customer receipts" ON customer_receipts FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users can create customer receipts" ON customer_receipts FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Users can update customer receipts" ON customer_receipts FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Users can delete customer receipts" ON customer_receipts FOR DELETE TO authenticated USING (true);

-- Receipt Allocations
CREATE POLICY "Users can view receipt allocations" ON receipt_allocations FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users can create receipt allocations" ON receipt_allocations FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Users can update receipt allocations" ON receipt_allocations FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Users can delete receipt allocations" ON receipt_allocations FOR DELETE TO authenticated USING (true);

-- Bank Accounts
CREATE POLICY "Users can view bank accounts" ON bank_accounts FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users can create bank accounts" ON bank_accounts FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Users can update bank accounts" ON bank_accounts FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Users can delete bank accounts" ON bank_accounts FOR DELETE TO authenticated USING (true);

-- Bank Transactions
CREATE POLICY "Users can view bank transactions" ON bank_transactions FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users can create bank transactions" ON bank_transactions FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Users can update bank transactions" ON bank_transactions FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Users can delete bank transactions" ON bank_transactions FOR DELETE TO authenticated USING (true);

-- Bank Statements
CREATE POLICY "Users can view bank statements" ON bank_statements FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users can create bank statements" ON bank_statements FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Users can update bank statements" ON bank_statements FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Users can delete bank statements" ON bank_statements FOR DELETE TO authenticated USING (true);

-- Bank Reconciliations
CREATE POLICY "Users can view bank reconciliations" ON bank_reconciliations FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users can create bank reconciliations" ON bank_reconciliations FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Users can update bank reconciliations" ON bank_reconciliations FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Users can delete bank reconciliations" ON bank_reconciliations FOR DELETE TO authenticated USING (true);

-- Asset Transactions
CREATE POLICY "Users can view asset transactions" ON asset_transactions FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users can create asset transactions" ON asset_transactions FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Users can update asset transactions" ON asset_transactions FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Users can delete asset transactions" ON asset_transactions FOR DELETE TO authenticated USING (true);

-- Depreciation Schedule
CREATE POLICY "Users can view depreciation schedule" ON depreciation_schedule FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users can create depreciation schedule" ON depreciation_schedule FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Users can update depreciation schedule" ON depreciation_schedule FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Users can delete depreciation schedule" ON depreciation_schedule FOR DELETE TO authenticated USING (true);

-- Profit Centers
CREATE POLICY "Users can view profit centers" ON profit_centers FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users can create profit centers" ON profit_centers FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Users can update profit centers" ON profit_centers FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Users can delete profit centers" ON profit_centers FOR DELETE TO authenticated USING (true);

-- Budgets
CREATE POLICY "Users can view budgets" ON budgets FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users can create budgets" ON budgets FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Users can update budgets" ON budgets FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Users can delete budgets" ON budgets FOR DELETE TO authenticated USING (true);

-- Budget Lines
CREATE POLICY "Users can view budget lines" ON budget_lines FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users can create budget lines" ON budget_lines FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Users can update budget lines" ON budget_lines FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Users can delete budget lines" ON budget_lines FOR DELETE TO authenticated USING (true);

-- =============================================
-- Create indexes for performance
-- =============================================

CREATE INDEX IF NOT EXISTS idx_supplier_invoices_supplier ON supplier_invoices(supplier_id);
CREATE INDEX IF NOT EXISTS idx_supplier_invoices_status ON supplier_invoices(status);
CREATE INDEX IF NOT EXISTS idx_supplier_invoices_company ON supplier_invoices(company_id);
CREATE INDEX IF NOT EXISTS idx_supplier_invoices_due_date ON supplier_invoices(due_date);

CREATE INDEX IF NOT EXISTS idx_customer_invoices_customer ON customer_invoices(customer_id);
CREATE INDEX IF NOT EXISTS idx_customer_invoices_status ON customer_invoices(status);
CREATE INDEX IF NOT EXISTS idx_customer_invoices_company ON customer_invoices(company_id);

CREATE INDEX IF NOT EXISTS idx_bank_transactions_account ON bank_transactions(bank_account_id);
CREATE INDEX IF NOT EXISTS idx_bank_transactions_date ON bank_transactions(transaction_date);

CREATE INDEX IF NOT EXISTS idx_budget_lines_budget ON budget_lines(budget_id);
CREATE INDEX IF NOT EXISTS idx_budget_lines_account ON budget_lines(account_id);

-- =============================================
-- Sequence for document numbering
-- =============================================

CREATE SEQUENCE IF NOT EXISTS supplier_invoice_seq START 1000;
CREATE SEQUENCE IF NOT EXISTS supplier_payment_seq START 1000;
CREATE SEQUENCE IF NOT EXISTS customer_invoice_seq START 1000;
CREATE SEQUENCE IF NOT EXISTS customer_receipt_seq START 1000;