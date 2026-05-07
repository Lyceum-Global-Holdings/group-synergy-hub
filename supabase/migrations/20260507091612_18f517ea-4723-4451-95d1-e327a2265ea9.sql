
-- 1. Extend app_role enum
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'supplier';

-- citext for case-insensitive emails
CREATE EXTENSION IF NOT EXISTS citext;

-- ============================================================
-- 2. TABLES
-- ============================================================

-- supplier_users
CREATE TABLE public.supplier_users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_id uuid NOT NULL REFERENCES public.suppliers(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  portal_role text NOT NULL CHECK (portal_role IN ('owner','contributor','viewer')),
  is_active boolean NOT NULL DEFAULT true,
  invited_by uuid,
  invited_at timestamptz DEFAULT now(),
  accepted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (supplier_id, user_id)
);
CREATE INDEX idx_supplier_users_user ON public.supplier_users(user_id);
CREATE INDEX idx_supplier_users_supplier_active ON public.supplier_users(supplier_id, is_active);

-- supplier_invitations
CREATE TABLE public.supplier_invitations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_id uuid NOT NULL REFERENCES public.suppliers(id) ON DELETE CASCADE,
  company_id uuid REFERENCES public.companies(id) ON DELETE SET NULL,
  email citext NOT NULL,
  portal_role text NOT NULL CHECK (portal_role IN ('owner','contributor','viewer')),
  token_hash text NOT NULL,
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '7 days'),
  accepted_at timestamptz,
  revoked_at timestamptz,
  invited_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX idx_supplier_invitations_token ON public.supplier_invitations(token_hash);
CREATE INDEX idx_supplier_invitations_email ON public.supplier_invitations(email);
CREATE UNIQUE INDEX idx_supplier_invitations_open
  ON public.supplier_invitations(supplier_id, email)
  WHERE accepted_at IS NULL AND revoked_at IS NULL;

-- peppol_participants
CREATE TABLE public.peppol_participants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_type text NOT NULL CHECK (owner_type IN ('company','supplier')),
  owner_id uuid NOT NULL,
  scheme_id text NOT NULL,
  participant_id text NOT NULL CHECK (participant_id ~ '^[A-Za-z0-9:_.-]+$'),
  is_primary boolean NOT NULL DEFAULT true,
  verified_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (owner_type, owner_id, scheme_id, participant_id)
);
CREATE INDEX idx_peppol_owner ON public.peppol_participants(owner_type, owner_id);

-- supplier_profiles_extended
CREATE TABLE public.supplier_profiles_extended (
  supplier_id uuid PRIMARY KEY REFERENCES public.suppliers(id) ON DELETE CASCADE,
  legal_name text,
  tax_id text,
  bank_account_name text,
  bank_account_number text,
  bank_iban text,
  bank_swift text,
  default_currency char(3),
  default_payment_terms_days int,
  peppol_enabled boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid
);

-- supplier_portal_audit
CREATE TABLE public.supplier_portal_audit (
  id bigserial PRIMARY KEY,
  supplier_id uuid,
  actor_user_id uuid,
  action text NOT NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  ip inet,
  user_agent text,
  prev_hash text,
  row_hash text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_supplier_audit_supplier_created ON public.supplier_portal_audit(supplier_id, created_at DESC);

-- ============================================================
-- 3. updated_at triggers
-- ============================================================
CREATE TRIGGER trg_supplier_users_updated
  BEFORE UPDATE ON public.supplier_users
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER trg_supplier_profiles_extended_updated
  BEFORE UPDATE ON public.supplier_profiles_extended
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================
-- 4. Helper functions (SECURITY DEFINER, search_path locked)
-- ============================================================

CREATE OR REPLACE FUNCTION public.is_supplier_member(_supplier_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.supplier_users
    WHERE supplier_id = _supplier_id
      AND user_id = auth.uid()
      AND is_active = true
  );
$$;

CREATE OR REPLACE FUNCTION public.is_supplier_owner(_supplier_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.supplier_users
    WHERE supplier_id = _supplier_id
      AND user_id = auth.uid()
      AND is_active = true
      AND portal_role = 'owner'
  );
$$;

CREATE OR REPLACE FUNCTION public.current_supplier_ids()
RETURNS SETOF uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT supplier_id FROM public.supplier_users
  WHERE user_id = auth.uid() AND is_active = true;
$$;

-- Hash-chain trigger for audit
CREATE OR REPLACE FUNCTION public.supplier_portal_audit_hash()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  last_hash text;
BEGIN
  SELECT row_hash INTO last_hash
  FROM public.supplier_portal_audit
  ORDER BY id DESC
  LIMIT 1;

  NEW.prev_hash := COALESCE(last_hash, '');
  NEW.row_hash := encode(
    digest(
      COALESCE(NEW.prev_hash,'') ||
      COALESCE(NEW.supplier_id::text,'') ||
      COALESCE(NEW.actor_user_id::text,'') ||
      COALESCE(NEW.action,'') ||
      COALESCE(NEW.metadata::text,'') ||
      COALESCE(NEW.created_at::text,''),
      'sha256'
    ),
    'hex'
  );
  RETURN NEW;
END;
$$;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TRIGGER trg_supplier_portal_audit_hash
  BEFORE INSERT ON public.supplier_portal_audit
  FOR EACH ROW EXECUTE FUNCTION public.supplier_portal_audit_hash();

CREATE OR REPLACE FUNCTION public.log_supplier_portal_event(
  _supplier_id uuid,
  _action text,
  _metadata jsonb DEFAULT '{}'::jsonb
)
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_id bigint;
BEGIN
  INSERT INTO public.supplier_portal_audit (supplier_id, actor_user_id, action, metadata)
  VALUES (_supplier_id, auth.uid(), _action, COALESCE(_metadata,'{}'::jsonb))
  RETURNING id INTO new_id;
  RETURN new_id;
END;
$$;

-- ============================================================
-- 5. RLS
-- ============================================================
ALTER TABLE public.supplier_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.supplier_invitations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.peppol_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.supplier_profiles_extended ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.supplier_portal_audit ENABLE ROW LEVEL SECURITY;

-- supplier_users
CREATE POLICY "admins manage supplier_users"
  ON public.supplier_users FOR ALL
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'super_admin'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'super_admin'));

CREATE POLICY "supplier members read own"
  ON public.supplier_users FOR SELECT
  USING (public.is_supplier_member(supplier_id));

CREATE POLICY "supplier owner insert non-owner"
  ON public.supplier_users FOR INSERT
  WITH CHECK (public.is_supplier_owner(supplier_id) AND portal_role <> 'owner');

CREATE POLICY "supplier owner update non-owner-promotions"
  ON public.supplier_users FOR UPDATE
  USING (public.is_supplier_owner(supplier_id))
  WITH CHECK (public.is_supplier_owner(supplier_id) AND portal_role <> 'owner');

CREATE POLICY "supplier owner delete non-owner"
  ON public.supplier_users FOR DELETE
  USING (public.is_supplier_owner(supplier_id) AND portal_role <> 'owner');

-- supplier_invitations: admins only
CREATE POLICY "admins manage supplier_invitations"
  ON public.supplier_invitations FOR ALL
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'super_admin') OR public.has_role(auth.uid(),'manager'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'super_admin') OR public.has_role(auth.uid(),'manager'));

-- peppol_participants
CREATE POLICY "admins manage peppol"
  ON public.peppol_participants FOR ALL
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'super_admin'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'super_admin'));

CREATE POLICY "supplier members read peppol"
  ON public.peppol_participants FOR SELECT
  USING (owner_type = 'supplier' AND public.is_supplier_member(owner_id));

CREATE POLICY "supplier owners write peppol"
  ON public.peppol_participants FOR INSERT
  WITH CHECK (owner_type = 'supplier' AND public.is_supplier_owner(owner_id));

CREATE POLICY "supplier owners update peppol"
  ON public.peppol_participants FOR UPDATE
  USING (owner_type = 'supplier' AND public.is_supplier_owner(owner_id))
  WITH CHECK (owner_type = 'supplier' AND public.is_supplier_owner(owner_id));

CREATE POLICY "supplier owners delete peppol"
  ON public.peppol_participants FOR DELETE
  USING (owner_type = 'supplier' AND public.is_supplier_owner(owner_id));

-- supplier_profiles_extended
CREATE POLICY "admins manage supplier profiles ext"
  ON public.supplier_profiles_extended FOR ALL
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'super_admin'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'super_admin'));

CREATE POLICY "supplier members read profile ext"
  ON public.supplier_profiles_extended FOR SELECT
  USING (public.is_supplier_member(supplier_id));

CREATE POLICY "supplier owners upsert profile ext"
  ON public.supplier_profiles_extended FOR INSERT
  WITH CHECK (public.is_supplier_owner(supplier_id));

CREATE POLICY "supplier owners update profile ext"
  ON public.supplier_profiles_extended FOR UPDATE
  USING (public.is_supplier_owner(supplier_id))
  WITH CHECK (public.is_supplier_owner(supplier_id));

-- supplier_portal_audit (no INSERT policy; only via SECURITY DEFINER function)
CREATE POLICY "admins read audit"
  ON public.supplier_portal_audit FOR SELECT
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'super_admin'));

CREATE POLICY "supplier members read own audit"
  ON public.supplier_portal_audit FOR SELECT
  USING (supplier_id IS NOT NULL AND public.is_supplier_member(supplier_id));

-- ============================================================
-- 6. Storage bucket + policies
-- ============================================================
INSERT INTO storage.buckets (id, name, public)
VALUES ('supplier-documents','supplier-documents', false)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "supplier docs read"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'supplier-documents'
    AND (
      public.has_role(auth.uid(),'admin')
      OR public.has_role(auth.uid(),'super_admin')
      OR public.is_supplier_member(((storage.foldername(name))[1])::uuid)
    )
  );

CREATE POLICY "supplier docs insert"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'supplier-documents'
    AND (
      public.has_role(auth.uid(),'admin')
      OR public.has_role(auth.uid(),'super_admin')
      OR public.is_supplier_member(((storage.foldername(name))[1])::uuid)
    )
  );

CREATE POLICY "supplier docs update"
  ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'supplier-documents'
    AND (
      public.has_role(auth.uid(),'admin')
      OR public.has_role(auth.uid(),'super_admin')
      OR public.is_supplier_owner(((storage.foldername(name))[1])::uuid)
    )
  );

CREATE POLICY "supplier docs delete"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'supplier-documents'
    AND (
      public.has_role(auth.uid(),'admin')
      OR public.has_role(auth.uid(),'super_admin')
      OR public.is_supplier_owner(((storage.foldername(name))[1])::uuid)
    )
  );
