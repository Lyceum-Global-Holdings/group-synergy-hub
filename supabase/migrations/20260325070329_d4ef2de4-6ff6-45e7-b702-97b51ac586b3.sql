
-- Debit Notes (AP)
CREATE TABLE public.debit_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid REFERENCES public.companies(id),
  supplier_id uuid REFERENCES public.suppliers(id),
  debit_note_number text NOT NULL,
  debit_date date NOT NULL DEFAULT CURRENT_DATE,
  reference_invoice_id uuid REFERENCES public.supplier_invoices(id),
  amount numeric NOT NULL DEFAULT 0,
  amount_applied numeric NOT NULL DEFAULT 0,
  reason text,
  description text,
  status text NOT NULL DEFAULT 'draft',
  created_by uuid,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.debit_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.debit_notes FORCE ROW LEVEL SECURITY;

CREATE POLICY "debit_notes_select" ON public.debit_notes FOR SELECT TO authenticated
  USING (public.can_access_company(company_id));
CREATE POLICY "debit_notes_insert" ON public.debit_notes FOR INSERT TO authenticated
  WITH CHECK (public.can_access_company(company_id));
CREATE POLICY "debit_notes_update" ON public.debit_notes FOR UPDATE TO authenticated
  USING (public.can_access_company(company_id));

-- Vendor Advances (AP)
CREATE TABLE public.vendor_advances (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid REFERENCES public.companies(id),
  supplier_id uuid REFERENCES public.suppliers(id),
  advance_number text NOT NULL,
  advance_date date NOT NULL DEFAULT CURRENT_DATE,
  amount numeric NOT NULL DEFAULT 0,
  remaining_amount numeric NOT NULL DEFAULT 0,
  payment_method text,
  reference_number text,
  description text,
  status text NOT NULL DEFAULT 'pending',
  journal_entry_id uuid REFERENCES public.journal_entries(id),
  created_by uuid,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.vendor_advances ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vendor_advances FORCE ROW LEVEL SECURITY;

CREATE POLICY "vendor_advances_select" ON public.vendor_advances FOR SELECT TO authenticated
  USING (public.can_access_company(company_id));
CREATE POLICY "vendor_advances_insert" ON public.vendor_advances FOR INSERT TO authenticated
  WITH CHECK (public.can_access_company(company_id));
CREATE POLICY "vendor_advances_update" ON public.vendor_advances FOR UPDATE TO authenticated
  USING (public.can_access_company(company_id));

-- WHT Certificates
CREATE TABLE public.wht_certificates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid REFERENCES public.companies(id),
  supplier_id uuid REFERENCES public.suppliers(id),
  certificate_number text NOT NULL,
  certificate_date date NOT NULL DEFAULT CURRENT_DATE,
  tax_period text,
  wht_rate numeric NOT NULL DEFAULT 0,
  gross_amount numeric NOT NULL DEFAULT 0,
  wht_amount numeric NOT NULL DEFAULT 0,
  net_amount numeric NOT NULL DEFAULT 0,
  payment_id uuid REFERENCES public.supplier_payments(id),
  status text NOT NULL DEFAULT 'draft',
  notes text,
  created_by uuid,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.wht_certificates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wht_certificates FORCE ROW LEVEL SECURITY;

CREATE POLICY "wht_certificates_select" ON public.wht_certificates FOR SELECT TO authenticated
  USING (public.can_access_company(company_id));
CREATE POLICY "wht_certificates_insert" ON public.wht_certificates FOR INSERT TO authenticated
  WITH CHECK (public.can_access_company(company_id));
CREATE POLICY "wht_certificates_update" ON public.wht_certificates FOR UPDATE TO authenticated
  USING (public.can_access_company(company_id));
