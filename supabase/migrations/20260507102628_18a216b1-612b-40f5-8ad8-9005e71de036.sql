
-- ============================================================
-- Phase 2: PEPPOL e-invoicing core schema
-- ============================================================

-- Direction & status enums
DO $$ BEGIN
  CREATE TYPE public.einvoice_direction AS ENUM ('outbound', 'inbound');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.einvoice_status AS ENUM (
    'draft', 'validated', 'ready_to_send', 'sent',
    'received', 'accepted', 'rejected', 'paid', 'cancelled'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.einvoice_match_status AS ENUM (
    'unmatched', 'partial', 'matched', 'discrepancy'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.einvoice_event_type AS ENUM (
    'created','updated','validated','submitted',
    'ack_received','rejected','matched','posted','cancelled'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ============================================================
-- einvoices (header)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.einvoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE RESTRICT,
  direction public.einvoice_direction NOT NULL,
  supplier_id UUID REFERENCES public.suppliers(id) ON DELETE RESTRICT,
  customer_company_id UUID REFERENCES public.companies(id) ON DELETE RESTRICT,
  invoice_number TEXT NOT NULL,
  issue_date DATE NOT NULL,
  due_date DATE,
  currency TEXT NOT NULL DEFAULT 'USD',
  subtotal NUMERIC(18,4) NOT NULL DEFAULT 0,
  tax_total NUMERIC(18,4) NOT NULL DEFAULT 0,
  grand_total NUMERIC(18,4) NOT NULL DEFAULT 0,
  status public.einvoice_status NOT NULL DEFAULT 'draft',
  match_status public.einvoice_match_status NOT NULL DEFAULT 'unmatched',
  peppol_message_id TEXT,
  peppol_profile TEXT NOT NULL DEFAULT 'urn:fdc:peppol.eu:2017:poacc:billing:01:1.0',
  peppol_customization TEXT NOT NULL DEFAULT 'urn:cen.eu:en16931:2017#compliant#urn:fdc:peppol.eu:2017:poacc:billing:3.0',
  ubl_xml_path TEXT,
  pdf_path TEXT,
  validation_report JSONB,
  po_id UUID REFERENCES public.purchase_orders(id) ON DELETE SET NULL,
  grn_id UUID,
  notes TEXT,
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (company_id, direction, invoice_number)
);

CREATE INDEX IF NOT EXISTS einvoices_company_status_created_idx
  ON public.einvoices (company_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS einvoices_supplier_issue_idx
  ON public.einvoices (supplier_id, issue_date DESC);
CREATE INDEX IF NOT EXISTS einvoices_po_idx
  ON public.einvoices (po_id);
CREATE INDEX IF NOT EXISTS einvoices_peppol_msg_idx
  ON public.einvoices (peppol_message_id);

-- ============================================================
-- einvoice_lines
-- ============================================================
CREATE TABLE IF NOT EXISTS public.einvoice_lines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  einvoice_id UUID NOT NULL REFERENCES public.einvoices(id) ON DELETE CASCADE,
  line_no INTEGER NOT NULL,
  item_code TEXT,
  description TEXT NOT NULL,
  quantity NUMERIC(18,4) NOT NULL,
  unit TEXT NOT NULL DEFAULT 'EA',
  unit_price NUMERIC(18,4) NOT NULL,
  line_extension NUMERIC(18,4) NOT NULL,
  tax_category TEXT NOT NULL DEFAULT 'S',
  tax_rate NUMERIC(7,4) NOT NULL DEFAULT 0,
  tax_amount NUMERIC(18,4) NOT NULL DEFAULT 0,
  po_line_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (einvoice_id, line_no)
);

CREATE INDEX IF NOT EXISTS einvoice_lines_einvoice_idx
  ON public.einvoice_lines (einvoice_id, line_no);

-- ============================================================
-- einvoice_attachments
-- ============================================================
CREATE TABLE IF NOT EXISTS public.einvoice_attachments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  einvoice_id UUID NOT NULL REFERENCES public.einvoices(id) ON DELETE CASCADE,
  file_path TEXT NOT NULL,
  file_name TEXT NOT NULL,
  mime_type TEXT,
  byte_size BIGINT,
  uploaded_by UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS einvoice_attachments_einvoice_idx
  ON public.einvoice_attachments (einvoice_id);

-- ============================================================
-- einvoice_events (hash-chained, append-only)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.einvoice_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  einvoice_id UUID NOT NULL REFERENCES public.einvoices(id) ON DELETE CASCADE,
  event_type public.einvoice_event_type NOT NULL,
  actor_user_id UUID,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  ip TEXT,
  user_agent TEXT,
  prev_hash TEXT,
  row_hash TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS einvoice_events_einvoice_idx
  ON public.einvoice_events (einvoice_id, created_at);

-- Hash chain trigger
CREATE OR REPLACE FUNCTION public.einvoice_events_hash()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_prev TEXT;
BEGIN
  SELECT row_hash INTO v_prev
  FROM public.einvoice_events
  WHERE einvoice_id = NEW.einvoice_id
  ORDER BY created_at DESC, id DESC
  LIMIT 1;

  NEW.prev_hash := v_prev;
  NEW.row_hash := encode(
    extensions.digest(
      coalesce(v_prev, '') ||
      NEW.einvoice_id::text ||
      NEW.event_type::text ||
      coalesce(NEW.actor_user_id::text, '') ||
      NEW.payload::text ||
      NEW.created_at::text,
      'sha256'
    ),
    'hex'
  );
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS einvoice_events_hash_trg ON public.einvoice_events;
CREATE TRIGGER einvoice_events_hash_trg
  BEFORE INSERT ON public.einvoice_events
  FOR EACH ROW EXECUTE FUNCTION public.einvoice_events_hash();

-- Append-only: prevent UPDATE/DELETE
CREATE OR REPLACE FUNCTION public.einvoice_events_append_only()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'einvoice_events is append-only';
END $$;

DROP TRIGGER IF EXISTS einvoice_events_no_update ON public.einvoice_events;
CREATE TRIGGER einvoice_events_no_update
  BEFORE UPDATE OR DELETE ON public.einvoice_events
  FOR EACH ROW EXECUTE FUNCTION public.einvoice_events_append_only();

-- Status transition guard
CREATE OR REPLACE FUNCTION public.einvoice_status_guard()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND OLD.status <> NEW.status THEN
    -- Allowed transitions
    IF NOT (
      (OLD.status = 'draft' AND NEW.status IN ('validated','cancelled')) OR
      (OLD.status = 'validated' AND NEW.status IN ('ready_to_send','draft','cancelled')) OR
      (OLD.status = 'ready_to_send' AND NEW.status IN ('sent','cancelled')) OR
      (OLD.status = 'sent' AND NEW.status IN ('accepted','rejected')) OR
      (OLD.status = 'accepted' AND NEW.status IN ('paid')) OR
      (OLD.status = 'received' AND NEW.status IN ('accepted','rejected')) OR
      (OLD.status = 'rejected' AND NEW.status IN ('draft'))
    ) THEN
      RAISE EXCEPTION 'Illegal e-invoice status transition: % -> %', OLD.status, NEW.status;
    END IF;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS einvoices_status_guard_trg ON public.einvoices;
CREATE TRIGGER einvoices_status_guard_trg
  BEFORE UPDATE ON public.einvoices
  FOR EACH ROW EXECUTE FUNCTION public.einvoice_status_guard();

-- updated_at trigger
DROP TRIGGER IF EXISTS einvoices_updated_at_trg ON public.einvoices;
CREATE TRIGGER einvoices_updated_at_trg
  BEFORE UPDATE ON public.einvoices
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================
-- Verify hash chain RPC
-- ============================================================
CREATE OR REPLACE FUNCTION public.verify_einvoice_event_chain(p_einvoice_id UUID)
RETURNS TABLE (event_id UUID, is_valid BOOLEAN, expected_hash TEXT, actual_hash TEXT)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  r RECORD;
  v_prev TEXT := NULL;
  v_expected TEXT;
BEGIN
  FOR r IN
    SELECT * FROM public.einvoice_events
    WHERE einvoice_id = p_einvoice_id
    ORDER BY created_at, id
  LOOP
    v_expected := encode(
      extensions.digest(
        coalesce(v_prev, '') ||
        r.einvoice_id::text ||
        r.event_type::text ||
        coalesce(r.actor_user_id::text, '') ||
        r.payload::text ||
        r.created_at::text,
        'sha256'
      ),
      'hex'
    );
    event_id := r.id;
    expected_hash := v_expected;
    actual_hash := r.row_hash;
    is_valid := (v_expected = r.row_hash);
    RETURN NEXT;
    v_prev := r.row_hash;
  END LOOP;
END $$;

-- ============================================================
-- Enable RLS
-- ============================================================
ALTER TABLE public.einvoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.einvoice_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.einvoice_attachments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.einvoice_events ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- RLS: einvoices
-- ============================================================
DROP POLICY IF EXISTS einvoices_admin_all ON public.einvoices;
CREATE POLICY einvoices_admin_all ON public.einvoices
  FOR ALL TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::app_role) OR
    public.has_role(auth.uid(), 'super_admin'::app_role)
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'admin'::app_role) OR
    public.has_role(auth.uid(), 'super_admin'::app_role)
  );

DROP POLICY IF EXISTS einvoices_supplier_select ON public.einvoices;
CREATE POLICY einvoices_supplier_select ON public.einvoices
  FOR SELECT TO authenticated
  USING (
    direction = 'outbound'
    AND supplier_id IS NOT NULL
    AND public.is_supplier_member(supplier_id)
  );

DROP POLICY IF EXISTS einvoices_supplier_insert ON public.einvoices;
CREATE POLICY einvoices_supplier_insert ON public.einvoices
  FOR INSERT TO authenticated
  WITH CHECK (
    direction = 'outbound'
    AND status = 'draft'
    AND supplier_id IS NOT NULL
    AND public.is_supplier_owner(supplier_id)
    AND created_by = auth.uid()
  );

DROP POLICY IF EXISTS einvoices_supplier_update_draft ON public.einvoices;
CREATE POLICY einvoices_supplier_update_draft ON public.einvoices
  FOR UPDATE TO authenticated
  USING (
    direction = 'outbound'
    AND status IN ('draft','rejected')
    AND supplier_id IS NOT NULL
    AND public.is_supplier_owner(supplier_id)
  )
  WITH CHECK (
    direction = 'outbound'
    AND supplier_id IS NOT NULL
    AND public.is_supplier_owner(supplier_id)
  );

-- ============================================================
-- RLS: einvoice_lines (mirror parent)
-- ============================================================
DROP POLICY IF EXISTS einvoice_lines_admin_all ON public.einvoice_lines;
CREATE POLICY einvoice_lines_admin_all ON public.einvoice_lines
  FOR ALL TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::app_role) OR
    public.has_role(auth.uid(), 'super_admin'::app_role)
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'admin'::app_role) OR
    public.has_role(auth.uid(), 'super_admin'::app_role)
  );

DROP POLICY IF EXISTS einvoice_lines_supplier_select ON public.einvoice_lines;
CREATE POLICY einvoice_lines_supplier_select ON public.einvoice_lines
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.einvoices e
      WHERE e.id = einvoice_lines.einvoice_id
        AND e.supplier_id IS NOT NULL
        AND public.is_supplier_member(e.supplier_id)
    )
  );

DROP POLICY IF EXISTS einvoice_lines_supplier_write ON public.einvoice_lines;
CREATE POLICY einvoice_lines_supplier_write ON public.einvoice_lines
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.einvoices e
      WHERE e.id = einvoice_lines.einvoice_id
        AND e.status IN ('draft','rejected')
        AND e.supplier_id IS NOT NULL
        AND public.is_supplier_owner(e.supplier_id)
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.einvoices e
      WHERE e.id = einvoice_lines.einvoice_id
        AND e.status IN ('draft','rejected')
        AND e.supplier_id IS NOT NULL
        AND public.is_supplier_owner(e.supplier_id)
    )
  );

-- ============================================================
-- RLS: einvoice_attachments
-- ============================================================
DROP POLICY IF EXISTS einvoice_attachments_admin_all ON public.einvoice_attachments;
CREATE POLICY einvoice_attachments_admin_all ON public.einvoice_attachments
  FOR ALL TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::app_role) OR
    public.has_role(auth.uid(), 'super_admin'::app_role)
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'admin'::app_role) OR
    public.has_role(auth.uid(), 'super_admin'::app_role)
  );

DROP POLICY IF EXISTS einvoice_attachments_supplier_select ON public.einvoice_attachments;
CREATE POLICY einvoice_attachments_supplier_select ON public.einvoice_attachments
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.einvoices e
      WHERE e.id = einvoice_attachments.einvoice_id
        AND e.supplier_id IS NOT NULL
        AND public.is_supplier_member(e.supplier_id)
    )
  );

DROP POLICY IF EXISTS einvoice_attachments_supplier_insert ON public.einvoice_attachments;
CREATE POLICY einvoice_attachments_supplier_insert ON public.einvoice_attachments
  FOR INSERT TO authenticated
  WITH CHECK (
    uploaded_by = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.einvoices e
      WHERE e.id = einvoice_attachments.einvoice_id
        AND e.status IN ('draft','rejected')
        AND e.supplier_id IS NOT NULL
        AND public.is_supplier_owner(e.supplier_id)
    )
  );

-- ============================================================
-- RLS: einvoice_events (read for related parties; insert via SECURITY DEFINER)
-- ============================================================
DROP POLICY IF EXISTS einvoice_events_admin_select ON public.einvoice_events;
CREATE POLICY einvoice_events_admin_select ON public.einvoice_events
  FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::app_role) OR
    public.has_role(auth.uid(), 'super_admin'::app_role)
  );

DROP POLICY IF EXISTS einvoice_events_supplier_select ON public.einvoice_events;
CREATE POLICY einvoice_events_supplier_select ON public.einvoice_events
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.einvoices e
      WHERE e.id = einvoice_events.einvoice_id
        AND e.supplier_id IS NOT NULL
        AND public.is_supplier_member(e.supplier_id)
    )
  );

-- Insert via authenticated parties; trigger enforces hash chain
DROP POLICY IF EXISTS einvoice_events_insert ON public.einvoice_events;
CREATE POLICY einvoice_events_insert ON public.einvoice_events
  FOR INSERT TO authenticated
  WITH CHECK (
    public.has_role(auth.uid(), 'admin'::app_role) OR
    public.has_role(auth.uid(), 'super_admin'::app_role) OR
    EXISTS (
      SELECT 1 FROM public.einvoices e
      WHERE e.id = einvoice_events.einvoice_id
        AND e.supplier_id IS NOT NULL
        AND public.is_supplier_member(e.supplier_id)
    )
  );

-- ============================================================
-- Helper to log einvoice events (server-side use)
-- ============================================================
CREATE OR REPLACE FUNCTION public.log_einvoice_event(
  p_einvoice_id UUID,
  p_event_type public.einvoice_event_type,
  p_payload JSONB DEFAULT '{}'::jsonb,
  p_ip TEXT DEFAULT NULL,
  p_user_agent TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id UUID;
BEGIN
  INSERT INTO public.einvoice_events (
    einvoice_id, event_type, actor_user_id, payload, ip, user_agent
  ) VALUES (
    p_einvoice_id, p_event_type, auth.uid(), coalesce(p_payload, '{}'::jsonb), p_ip, p_user_agent
  ) RETURNING id INTO v_id;
  RETURN v_id;
END $$;

-- ============================================================
-- Storage bucket: einvoices (private)
-- ============================================================
INSERT INTO storage.buckets (id, name, public)
VALUES ('einvoices', 'einvoices', false)
ON CONFLICT (id) DO NOTHING;

-- Internal admin/super_admin: full access on einvoices bucket
DROP POLICY IF EXISTS einvoices_storage_admin_all ON storage.objects;
CREATE POLICY einvoices_storage_admin_all ON storage.objects
  FOR ALL TO authenticated
  USING (
    bucket_id = 'einvoices' AND (
      public.has_role(auth.uid(), 'admin'::app_role) OR
      public.has_role(auth.uid(), 'super_admin'::app_role)
    )
  )
  WITH CHECK (
    bucket_id = 'einvoices' AND (
      public.has_role(auth.uid(), 'admin'::app_role) OR
      public.has_role(auth.uid(), 'super_admin'::app_role)
    )
  );

-- Suppliers: scoped read on their supplier_id subfolder
-- Path layout: {company_id}/{supplier_id}/{einvoice_id}/...
DROP POLICY IF EXISTS einvoices_storage_supplier_read ON storage.objects;
CREATE POLICY einvoices_storage_supplier_read ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'einvoices'
    AND (storage.foldername(name))[2] IS NOT NULL
    AND public.is_supplier_member(((storage.foldername(name))[2])::uuid)
  );

DROP POLICY IF EXISTS einvoices_storage_supplier_write ON storage.objects;
CREATE POLICY einvoices_storage_supplier_write ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'einvoices'
    AND (storage.foldername(name))[2] IS NOT NULL
    AND public.is_supplier_owner(((storage.foldername(name))[2])::uuid)
  );
