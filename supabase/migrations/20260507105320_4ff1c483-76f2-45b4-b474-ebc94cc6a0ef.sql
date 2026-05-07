
-- Phase 3: PEPPOL transmission, webhooks, and 3-way match

-- Extend einvoice_status enum
ALTER TYPE public.einvoice_status ADD VALUE IF NOT EXISTS 'submission_failed';
ALTER TYPE public.einvoice_status ADD VALUE IF NOT EXISTS 'delivered';

-- ====== Transmissions ======
CREATE TABLE IF NOT EXISTS public.einvoice_transmissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  einvoice_id uuid NOT NULL REFERENCES public.einvoices(id) ON DELETE CASCADE,
  provider text NOT NULL DEFAULT 'storecove',
  direction public.einvoice_direction NOT NULL,
  provider_message_id text,
  submitted_at timestamptz NOT NULL DEFAULT now(),
  last_status text NOT NULL DEFAULT 'pending',
  last_status_at timestamptz NOT NULL DEFAULT now(),
  attempt_count integer NOT NULL DEFAULT 1,
  error_message text,
  raw_response jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS einvoice_transmissions_provider_msg_uniq
  ON public.einvoice_transmissions(provider, provider_message_id)
  WHERE provider_message_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS einvoice_transmissions_einvoice_idx
  ON public.einvoice_transmissions(einvoice_id, created_at DESC);

ALTER TABLE public.einvoice_transmissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admins manage einvoice_transmissions"
  ON public.einvoice_transmissions FOR ALL TO authenticated
  USING (has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'super_admin'::app_role) OR has_role(auth.uid(),'manager'::app_role))
  WITH CHECK (has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'super_admin'::app_role) OR has_role(auth.uid(),'manager'::app_role));

CREATE POLICY "suppliers read own einvoice_transmissions"
  ON public.einvoice_transmissions FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.einvoices e
    WHERE e.id = einvoice_transmissions.einvoice_id
      AND public.is_supplier_member(e.supplier_id)
  ));

-- Append-only guard
CREATE OR REPLACE FUNCTION public.einvoice_transmissions_append_only()
RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public' AS $$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    -- only allow updating last_status, last_status_at, attempt_count, error_message, raw_response
    IF NEW.einvoice_id <> OLD.einvoice_id
       OR NEW.provider <> OLD.provider
       OR NEW.direction <> OLD.direction
       OR COALESCE(NEW.provider_message_id,'') <> COALESCE(OLD.provider_message_id,'')
       OR NEW.submitted_at <> OLD.submitted_at THEN
      RAISE EXCEPTION 'einvoice_transmissions: immutable fields changed';
    END IF;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'einvoice_transmissions: deletes not allowed';
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS einvoice_transmissions_guard ON public.einvoice_transmissions;
CREATE TRIGGER einvoice_transmissions_guard
  BEFORE UPDATE OR DELETE ON public.einvoice_transmissions
  FOR EACH ROW EXECUTE FUNCTION public.einvoice_transmissions_append_only();

-- ====== Match Results ======
CREATE TABLE IF NOT EXISTS public.einvoice_match_results (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  einvoice_id uuid NOT NULL REFERENCES public.einvoices(id) ON DELETE CASCADE,
  po_id uuid,
  grn_id uuid,
  total_match boolean NOT NULL DEFAULT false,
  qty_match boolean NOT NULL DEFAULT false,
  price_match boolean NOT NULL DEFAULT false,
  score numeric(5,2) NOT NULL DEFAULT 0,
  discrepancies jsonb NOT NULL DEFAULT '[]'::jsonb,
  evaluated_by uuid,
  evaluated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS einvoice_match_results_einvoice_idx
  ON public.einvoice_match_results(einvoice_id, evaluated_at DESC);

ALTER TABLE public.einvoice_match_results ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admins manage einvoice_match_results"
  ON public.einvoice_match_results FOR ALL TO authenticated
  USING (has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'super_admin'::app_role) OR has_role(auth.uid(),'manager'::app_role))
  WITH CHECK (has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'super_admin'::app_role) OR has_role(auth.uid(),'manager'::app_role));

CREATE POLICY "suppliers read own einvoice_match_results"
  ON public.einvoice_match_results FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.einvoices e
    WHERE e.id = einvoice_match_results.einvoice_id
      AND public.is_supplier_member(e.supplier_id)
  ));
