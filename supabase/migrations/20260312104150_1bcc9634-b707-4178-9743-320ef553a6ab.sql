CREATE TABLE public.production_daily_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  stage_id uuid REFERENCES public.production_order_stages(id) ON DELETE CASCADE NOT NULL,
  entry_date date NOT NULL DEFAULT CURRENT_DATE,
  input_qty integer NOT NULL DEFAULT 0,
  output_qty integer NOT NULL DEFAULT 0,
  wastage_qty integer NOT NULL DEFAULT 0,
  notes text,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(stage_id, entry_date)
);

ALTER TABLE public.production_daily_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage daily entries"
  ON public.production_daily_entries FOR ALL TO authenticated
  USING (true) WITH CHECK (true);