
-- ============ Enums ============
DO $$ BEGIN
  CREATE TYPE public.einvoice_document_type AS ENUM ('invoice','credit_note','debit_note');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.einvoice_compliance_profile AS ENUM ('peppol_bis_3','ksa_zatca_phase2','it_sdi','fr_facturx');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.peppol_environment AS ENUM ('sandbox','live');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.einvoice_country_mandate AS ENUM ('zatca','sdi','facturx');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ============ einvoices extensions ============
ALTER TABLE public.einvoices
  ADD COLUMN IF NOT EXISTS document_type public.einvoice_document_type NOT NULL DEFAULT 'invoice',
  ADD COLUMN IF NOT EXISTS corrected_einvoice_id uuid REFERENCES public.einvoices(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS compliance_profile public.einvoice_compliance_profile NOT NULL DEFAULT 'peppol_bis_3',
  ADD COLUMN IF NOT EXISTS archive_until date,
  ADD COLUMN IF NOT EXISTS legal_hold boolean NOT NULL DEFAULT false;

UPDATE public.einvoices SET archive_until = (created_at + interval '10 years')::date
  WHERE archive_until IS NULL;

CREATE INDEX IF NOT EXISTS idx_einvoices_corrected ON public.einvoices(corrected_einvoice_id);
CREATE INDEX IF NOT EXISTS idx_einvoices_profile ON public.einvoices(compliance_profile);

-- ============ companies extensions ============
ALTER TABLE public.companies
  ADD COLUMN IF NOT EXISTS peppol_environment public.peppol_environment NOT NULL DEFAULT 'sandbox',
  ADD COLUMN IF NOT EXISTS peppol_live_enabled_at timestamptz,
  ADD COLUMN IF NOT EXISTS peppol_live_enabled_by uuid,
  ADD COLUMN IF NOT EXISTS country_mandate_overrides jsonb NOT NULL DEFAULT '{}'::jsonb;

-- ============ einvoice_country_artifacts ============
CREATE TABLE IF NOT EXISTS public.einvoice_country_artifacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  einvoice_id uuid NOT NULL REFERENCES public.einvoices(id) ON DELETE CASCADE,
  company_id uuid NOT NULL,
  mandate public.einvoice_country_mandate NOT NULL,
  qr_code text,
  clearance_uuid text,
  clearance_status text,
  government_response jsonb NOT NULL DEFAULT '{}'::jsonb,
  cleared_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid
);

CREATE INDEX IF NOT EXISTS idx_eca_einvoice ON public.einvoice_country_artifacts(einvoice_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_eca_company ON public.einvoice_country_artifacts(company_id, created_at DESC);

ALTER TABLE public.einvoice_country_artifacts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "eca_read_company" ON public.einvoice_country_artifacts;
CREATE POLICY "eca_read_company" ON public.einvoice_country_artifacts
  FOR SELECT TO authenticated
  USING (public.can_access_company(company_id));

DROP POLICY IF EXISTS "eca_insert_admin" ON public.einvoice_country_artifacts;
CREATE POLICY "eca_insert_admin" ON public.einvoice_country_artifacts
  FOR INSERT TO authenticated
  WITH CHECK (
    public.can_access_company(company_id)
    AND (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'super_admin'))
  );

-- Append-only trigger
CREATE OR REPLACE FUNCTION public.einvoice_country_artifacts_no_mut()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'einvoice_country_artifacts is append-only';
END;
$$;

DROP TRIGGER IF EXISTS einvoice_country_artifacts_no_update ON public.einvoice_country_artifacts;
CREATE TRIGGER einvoice_country_artifacts_no_update
  BEFORE UPDATE OR DELETE ON public.einvoice_country_artifacts
  FOR EACH ROW EXECUTE FUNCTION public.einvoice_country_artifacts_no_mut();

-- ============ einvoice_attachment_keys ============
CREATE TABLE IF NOT EXISTS public.einvoice_attachment_keys (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  attachment_id uuid NOT NULL REFERENCES public.einvoice_attachments(id) ON DELETE CASCADE,
  company_id uuid NOT NULL,
  key_id text NOT NULL,
  wrapped_dek bytea NOT NULL,
  iv bytea NOT NULL,
  auth_tag bytea NOT NULL,
  algorithm text NOT NULL DEFAULT 'AES-256-GCM',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS uniq_eak_attachment ON public.einvoice_attachment_keys(attachment_id);

ALTER TABLE public.einvoice_attachment_keys ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "eak_read_admin" ON public.einvoice_attachment_keys;
CREATE POLICY "eak_read_admin" ON public.einvoice_attachment_keys
  FOR SELECT TO authenticated
  USING (
    public.can_access_company(company_id)
    AND (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'super_admin'))
  );

DROP POLICY IF EXISTS "eak_insert_admin" ON public.einvoice_attachment_keys;
CREATE POLICY "eak_insert_admin" ON public.einvoice_attachment_keys
  FOR INSERT TO authenticated
  WITH CHECK (
    public.can_access_company(company_id)
    AND (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'super_admin'))
  );

-- ============ Helper: enable live env (audit) ============
CREATE OR REPLACE FUNCTION public.set_peppol_environment(p_company_id uuid, p_env public.peppol_environment)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(),'super_admin') THEN
    RAISE EXCEPTION 'Only super_admin can change PEPPOL environment';
  END IF;
  UPDATE public.companies
     SET peppol_environment = p_env,
         peppol_live_enabled_at = CASE WHEN p_env='live' THEN now() ELSE peppol_live_enabled_at END,
         peppol_live_enabled_by = CASE WHEN p_env='live' THEN auth.uid() ELSE peppol_live_enabled_by END
   WHERE id = p_company_id;
END;
$$;
