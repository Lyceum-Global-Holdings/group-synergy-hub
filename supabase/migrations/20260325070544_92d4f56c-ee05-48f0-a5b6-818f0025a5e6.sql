
-- Credit Notes (AR)
CREATE TABLE public.credit_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid REFERENCES public.companies(id),
  customer_id uuid REFERENCES public.customers(id),
  credit_note_number text NOT NULL,
  credit_date date NOT NULL DEFAULT CURRENT_DATE,
  reference_invoice_id uuid REFERENCES public.customer_invoices(id),
  amount numeric NOT NULL DEFAULT 0,
  amount_applied numeric NOT NULL DEFAULT 0,
  reason text,
  description text,
  status text NOT NULL DEFAULT 'draft',
  created_by uuid,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.credit_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.credit_notes FORCE ROW LEVEL SECURITY;

CREATE POLICY "credit_notes_select" ON public.credit_notes FOR SELECT TO authenticated
  USING (public.can_access_company(company_id));
CREATE POLICY "credit_notes_insert" ON public.credit_notes FOR INSERT TO authenticated
  WITH CHECK (public.can_access_company(company_id));
CREATE POLICY "credit_notes_update" ON public.credit_notes FOR UPDATE TO authenticated
  USING (public.can_access_company(company_id));

-- Customer Advances (AR)
CREATE TABLE public.customer_advances (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid REFERENCES public.companies(id),
  customer_id uuid REFERENCES public.customers(id),
  advance_number text NOT NULL,
  advance_date date NOT NULL DEFAULT CURRENT_DATE,
  original_amount numeric NOT NULL DEFAULT 0,
  remaining_amount numeric NOT NULL DEFAULT 0,
  payment_method text,
  reference_number text,
  description text,
  status text NOT NULL DEFAULT 'received',
  journal_entry_id uuid REFERENCES public.journal_entries(id),
  created_by uuid,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.customer_advances ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customer_advances FORCE ROW LEVEL SECURITY;

CREATE POLICY "customer_advances_select" ON public.customer_advances FOR SELECT TO authenticated
  USING (public.can_access_company(company_id));
CREATE POLICY "customer_advances_insert" ON public.customer_advances FOR INSERT TO authenticated
  WITH CHECK (public.can_access_company(company_id));
CREATE POLICY "customer_advances_update" ON public.customer_advances FOR UPDATE TO authenticated
  USING (public.can_access_company(company_id));

-- Bad Debt Provisions (AR)
CREATE TABLE public.bad_debt_provisions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid REFERENCES public.companies(id),
  customer_id uuid REFERENCES public.customers(id),
  invoice_id uuid REFERENCES public.customer_invoices(id),
  provision_date date NOT NULL DEFAULT CURRENT_DATE,
  amount numeric NOT NULL DEFAULT 0,
  reason text,
  write_off_date date,
  recovery_amount numeric NOT NULL DEFAULT 0,
  journal_entry_id uuid REFERENCES public.journal_entries(id),
  status text NOT NULL DEFAULT 'provisioned',
  notes text,
  created_by uuid,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.bad_debt_provisions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bad_debt_provisions FORCE ROW LEVEL SECURITY;

CREATE POLICY "bad_debt_provisions_select" ON public.bad_debt_provisions FOR SELECT TO authenticated
  USING (public.can_access_company(company_id));
CREATE POLICY "bad_debt_provisions_insert" ON public.bad_debt_provisions FOR INSERT TO authenticated
  WITH CHECK (public.can_access_company(company_id));
CREATE POLICY "bad_debt_provisions_update" ON public.bad_debt_provisions FOR UPDATE TO authenticated
  USING (public.can_access_company(company_id));
