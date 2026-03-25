-- Asset Revaluations table
CREATE TABLE public.asset_revaluations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid REFERENCES public.companies(id),
  asset_id uuid NOT NULL REFERENCES public.warehouse_assets(id) ON DELETE CASCADE,
  revaluation_date date NOT NULL DEFAULT CURRENT_DATE,
  old_value numeric NOT NULL DEFAULT 0,
  new_value numeric NOT NULL DEFAULT 0,
  adjustment_amount numeric GENERATED ALWAYS AS (new_value - old_value) STORED,
  reason text,
  revalued_by uuid,
  journal_entry_id uuid REFERENCES public.journal_entries(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.asset_revaluations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view asset revaluations for their company"
  ON public.asset_revaluations FOR SELECT TO authenticated
  USING (company_id IN (SELECT id FROM public.companies));

CREATE POLICY "Users can insert asset revaluations"
  ON public.asset_revaluations FOR INSERT TO authenticated
  WITH CHECK (company_id IN (SELECT id FROM public.companies));

-- Asset Disposals table
CREATE TABLE public.asset_disposals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid REFERENCES public.companies(id),
  asset_id uuid NOT NULL REFERENCES public.warehouse_assets(id) ON DELETE CASCADE,
  disposal_date date NOT NULL DEFAULT CURRENT_DATE,
  disposal_method text NOT NULL DEFAULT 'sale',
  proceeds numeric NOT NULL DEFAULT 0,
  net_book_value_at_disposal numeric NOT NULL DEFAULT 0,
  gain_loss numeric GENERATED ALWAYS AS (proceeds - net_book_value_at_disposal) STORED,
  buyer_name text,
  notes text,
  disposed_by uuid,
  journal_entry_id uuid REFERENCES public.journal_entries(id),
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.asset_disposals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view asset disposals for their company"
  ON public.asset_disposals FOR SELECT TO authenticated
  USING (company_id IN (SELECT id FROM public.companies));

CREATE POLICY "Users can insert asset disposals"
  ON public.asset_disposals FOR INSERT TO authenticated
  WITH CHECK (company_id IN (SELECT id FROM public.companies));