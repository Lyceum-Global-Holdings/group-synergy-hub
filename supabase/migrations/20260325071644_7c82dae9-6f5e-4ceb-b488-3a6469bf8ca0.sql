
-- Expense Categories
CREATE TABLE public.expense_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid REFERENCES public.companies(id),
  category_name text NOT NULL,
  category_code text,
  parent_id uuid REFERENCES public.expense_categories(id),
  gl_account_id uuid REFERENCES public.chart_of_accounts(id),
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.expense_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expense_categories FORCE ROW LEVEL SECURITY;

CREATE POLICY "expense_categories_select" ON public.expense_categories FOR SELECT TO authenticated
  USING (public.can_access_company(company_id));
CREATE POLICY "expense_categories_insert" ON public.expense_categories FOR INSERT TO authenticated
  WITH CHECK (public.can_access_company(company_id));
CREATE POLICY "expense_categories_update" ON public.expense_categories FOR UPDATE TO authenticated
  USING (public.can_access_company(company_id));

-- Petty Cash Funds
CREATE TABLE public.petty_cash_funds (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid REFERENCES public.companies(id),
  fund_name text NOT NULL,
  fund_code text,
  custodian_id uuid,
  custodian_name text,
  float_amount numeric NOT NULL DEFAULT 0,
  current_balance numeric NOT NULL DEFAULT 0,
  gl_account_id uuid REFERENCES public.chart_of_accounts(id),
  location text,
  status text NOT NULL DEFAULT 'active',
  last_replenished_at timestamptz,
  created_by uuid,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.petty_cash_funds ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.petty_cash_funds FORCE ROW LEVEL SECURITY;

CREATE POLICY "petty_cash_funds_select" ON public.petty_cash_funds FOR SELECT TO authenticated
  USING (public.can_access_company(company_id));
CREATE POLICY "petty_cash_funds_insert" ON public.petty_cash_funds FOR INSERT TO authenticated
  WITH CHECK (public.can_access_company(company_id));
CREATE POLICY "petty_cash_funds_update" ON public.petty_cash_funds FOR UPDATE TO authenticated
  USING (public.can_access_company(company_id));

-- Petty Cash Vouchers
CREATE TABLE public.petty_cash_vouchers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid REFERENCES public.companies(id),
  fund_id uuid REFERENCES public.petty_cash_funds(id),
  voucher_number text NOT NULL,
  voucher_date date NOT NULL DEFAULT CURRENT_DATE,
  payee_name text NOT NULL,
  amount numeric NOT NULL DEFAULT 0,
  expense_category_id uuid REFERENCES public.expense_categories(id),
  description text,
  receipt_attached boolean NOT NULL DEFAULT false,
  approved_by uuid,
  approved_date timestamptz,
  journal_entry_id uuid REFERENCES public.journal_entries(id),
  status text NOT NULL DEFAULT 'draft',
  created_by uuid,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.petty_cash_vouchers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.petty_cash_vouchers FORCE ROW LEVEL SECURITY;

CREATE POLICY "petty_cash_vouchers_select" ON public.petty_cash_vouchers FOR SELECT TO authenticated
  USING (public.can_access_company(company_id));
CREATE POLICY "petty_cash_vouchers_insert" ON public.petty_cash_vouchers FOR INSERT TO authenticated
  WITH CHECK (public.can_access_company(company_id));
CREATE POLICY "petty_cash_vouchers_update" ON public.petty_cash_vouchers FOR UPDATE TO authenticated
  USING (public.can_access_company(company_id));

-- Staff Advances
CREATE TABLE public.staff_advances (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid REFERENCES public.companies(id),
  employee_id uuid,
  employee_name text NOT NULL,
  advance_number text NOT NULL,
  advance_date date NOT NULL DEFAULT CURRENT_DATE,
  purpose text,
  requested_amount numeric NOT NULL DEFAULT 0,
  approved_amount numeric,
  disbursed_amount numeric NOT NULL DEFAULT 0,
  settled_amount numeric NOT NULL DEFAULT 0,
  outstanding_amount numeric NOT NULL DEFAULT 0,
  payment_method text,
  approved_by uuid,
  approved_date timestamptz,
  disbursed_date date,
  settlement_due_date date,
  journal_entry_id uuid REFERENCES public.journal_entries(id),
  status text NOT NULL DEFAULT 'pending',
  notes text,
  created_by uuid,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.staff_advances ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.staff_advances FORCE ROW LEVEL SECURITY;

CREATE POLICY "staff_advances_select" ON public.staff_advances FOR SELECT TO authenticated
  USING (public.can_access_company(company_id));
CREATE POLICY "staff_advances_insert" ON public.staff_advances FOR INSERT TO authenticated
  WITH CHECK (public.can_access_company(company_id));
CREATE POLICY "staff_advances_update" ON public.staff_advances FOR UPDATE TO authenticated
  USING (public.can_access_company(company_id));
