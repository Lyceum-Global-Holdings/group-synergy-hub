
-- Cheque Register
CREATE TABLE public.cheques (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid REFERENCES public.companies(id),
  bank_account_id uuid REFERENCES public.bank_accounts(id),
  cheque_number text NOT NULL,
  cheque_type text NOT NULL DEFAULT 'issued',
  cheque_date date NOT NULL DEFAULT CURRENT_DATE,
  payee_payer text NOT NULL,
  amount numeric NOT NULL DEFAULT 0,
  description text,
  is_post_dated boolean NOT NULL DEFAULT false,
  clearing_date date,
  supplier_id uuid REFERENCES public.suppliers(id),
  customer_id uuid REFERENCES public.customers(id),
  journal_entry_id uuid REFERENCES public.journal_entries(id),
  status text NOT NULL DEFAULT 'issued',
  created_by uuid,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.cheques ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cheques FORCE ROW LEVEL SECURITY;

CREATE POLICY "cheques_select" ON public.cheques FOR SELECT TO authenticated
  USING (public.can_access_company(company_id));
CREATE POLICY "cheques_insert" ON public.cheques FOR INSERT TO authenticated
  WITH CHECK (public.can_access_company(company_id));
CREATE POLICY "cheques_update" ON public.cheques FOR UPDATE TO authenticated
  USING (public.can_access_company(company_id));

-- Fund Transfers
CREATE TABLE public.fund_transfers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid REFERENCES public.companies(id),
  from_account_id uuid REFERENCES public.bank_accounts(id),
  to_account_id uuid REFERENCES public.bank_accounts(id),
  transfer_date date NOT NULL DEFAULT CURRENT_DATE,
  amount numeric NOT NULL DEFAULT 0,
  from_currency text DEFAULT 'LKR',
  to_currency text DEFAULT 'LKR',
  exchange_rate numeric DEFAULT 1,
  reference_number text,
  description text,
  journal_entry_id uuid REFERENCES public.journal_entries(id),
  status text NOT NULL DEFAULT 'pending',
  created_by uuid,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.fund_transfers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fund_transfers FORCE ROW LEVEL SECURITY;

CREATE POLICY "fund_transfers_select" ON public.fund_transfers FOR SELECT TO authenticated
  USING (public.can_access_company(company_id));
CREATE POLICY "fund_transfers_insert" ON public.fund_transfers FOR INSERT TO authenticated
  WITH CHECK (public.can_access_company(company_id));
CREATE POLICY "fund_transfers_update" ON public.fund_transfers FOR UPDATE TO authenticated
  USING (public.can_access_company(company_id));

-- Payment Batches
CREATE TABLE public.payment_batches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid REFERENCES public.companies(id),
  bank_account_id uuid REFERENCES public.bank_accounts(id),
  batch_number text NOT NULL,
  batch_date date NOT NULL DEFAULT CURRENT_DATE,
  batch_type text NOT NULL DEFAULT 'supplier',
  payment_count integer NOT NULL DEFAULT 0,
  total_amount numeric NOT NULL DEFAULT 0,
  description text,
  approved_by uuid,
  approved_date timestamptz,
  status text NOT NULL DEFAULT 'draft',
  created_by uuid,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.payment_batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_batches FORCE ROW LEVEL SECURITY;

CREATE POLICY "payment_batches_select" ON public.payment_batches FOR SELECT TO authenticated
  USING (public.can_access_company(company_id));
CREATE POLICY "payment_batches_insert" ON public.payment_batches FOR INSERT TO authenticated
  WITH CHECK (public.can_access_company(company_id));
CREATE POLICY "payment_batches_update" ON public.payment_batches FOR UPDATE TO authenticated
  USING (public.can_access_company(company_id));

-- Transaction Rules
CREATE TABLE public.transaction_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid REFERENCES public.companies(id),
  rule_name text NOT NULL,
  match_pattern text NOT NULL,
  match_field text NOT NULL DEFAULT 'description',
  gl_account_id uuid REFERENCES public.chart_of_accounts(id),
  description_template text,
  is_active boolean NOT NULL DEFAULT true,
  priority integer NOT NULL DEFAULT 0,
  created_by uuid,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.transaction_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transaction_rules FORCE ROW LEVEL SECURITY;

CREATE POLICY "transaction_rules_select" ON public.transaction_rules FOR SELECT TO authenticated
  USING (public.can_access_company(company_id));
CREATE POLICY "transaction_rules_insert" ON public.transaction_rules FOR INSERT TO authenticated
  WITH CHECK (public.can_access_company(company_id));
CREATE POLICY "transaction_rules_update" ON public.transaction_rules FOR UPDATE TO authenticated
  USING (public.can_access_company(company_id));
