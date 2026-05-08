
-- MFA policy enum
DO $$ BEGIN
  CREATE TYPE public.mfa_policy AS ENUM ('disabled','optional','required_admins','required_all');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Security settings (singleton)
CREATE TABLE IF NOT EXISTS public.security_settings (
  id text PRIMARY KEY DEFAULT 'global',
  turnstile_enabled boolean NOT NULL DEFAULT true,
  turnstile_surfaces jsonb NOT NULL DEFAULT '{"auth":true,"portal_login":true,"portal_invite":true,"public_registration":true}'::jsonb,
  mfa_policy public.mfa_policy NOT NULL DEFAULT 'optional',
  mfa_grace_period_days integer NOT NULL DEFAULT 7 CHECK (mfa_grace_period_days >= 0 AND mfa_grace_period_days <= 90),
  mfa_remember_device_hours integer NOT NULL DEFAULT 0 CHECK (mfa_remember_device_hours >= 0 AND mfa_remember_device_hours <= 720),
  allowed_mfa_factors text[] NOT NULL DEFAULT ARRAY['totp']::text[],
  updated_by uuid,
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT security_settings_singleton CHECK (id = 'global')
);

INSERT INTO public.security_settings (id) VALUES ('global')
ON CONFLICT (id) DO NOTHING;

ALTER TABLE public.security_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "security_settings_read_all_authenticated" ON public.security_settings;
CREATE POLICY "security_settings_read_all_authenticated"
  ON public.security_settings FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "security_settings_update_super_admin" ON public.security_settings;
CREATE POLICY "security_settings_update_super_admin"
  ON public.security_settings FOR UPDATE
  TO authenticated
  USING (public.is_super_admin(auth.uid()))
  WITH CHECK (public.is_super_admin(auth.uid()));

DROP POLICY IF EXISTS "security_settings_insert_super_admin" ON public.security_settings;
CREATE POLICY "security_settings_insert_super_admin"
  ON public.security_settings FOR INSERT
  TO authenticated
  WITH CHECK (public.is_super_admin(auth.uid()));

-- Audit log
CREATE TABLE IF NOT EXISTS public.security_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  changed_by uuid,
  changed_at timestamptz NOT NULL DEFAULT now(),
  action text NOT NULL,
  before_value jsonb,
  after_value jsonb
);

CREATE INDEX IF NOT EXISTS security_audit_log_changed_at_idx
  ON public.security_audit_log (changed_at DESC);

ALTER TABLE public.security_audit_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "security_audit_log_read_super_admin" ON public.security_audit_log;
CREATE POLICY "security_audit_log_read_super_admin"
  ON public.security_audit_log FOR SELECT
  TO authenticated
  USING (public.is_super_admin(auth.uid()));

-- Audit trigger
CREATE OR REPLACE FUNCTION public.security_settings_audit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.security_audit_log (changed_by, action, before_value, after_value)
  VALUES (
    auth.uid(),
    TG_OP,
    CASE WHEN TG_OP = 'INSERT' THEN NULL ELSE to_jsonb(OLD) END,
    to_jsonb(NEW)
  );
  NEW.updated_at := now();
  NEW.updated_by := auth.uid();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_security_settings_audit ON public.security_settings;
CREATE TRIGGER trg_security_settings_audit
  BEFORE INSERT OR UPDATE ON public.security_settings
  FOR EACH ROW EXECUTE FUNCTION public.security_settings_audit();
