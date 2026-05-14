
-- 1. Portal settings
CREATE TABLE IF NOT EXISTS public.supplier_portal_settings (
  company_id uuid PRIMARY KEY REFERENCES public.companies(id) ON DELETE CASCADE,
  public_base_url text,
  is_active boolean NOT NULL DEFAULT true,
  updated_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT supplier_portal_settings_url_https
    CHECK (public_base_url IS NULL OR public_base_url ~* '^https?://[^[:space:]]+$')
);

ALTER TABLE public.supplier_portal_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "portal_settings_company_read"
  ON public.supplier_portal_settings FOR SELECT TO authenticated
  USING (public.can_access_company(company_id));

CREATE POLICY "portal_settings_admin_write"
  ON public.supplier_portal_settings FOR ALL TO authenticated
  USING (
    public.can_access_company(company_id)
    AND (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin'))
  )
  WITH CHECK (
    public.can_access_company(company_id)
    AND (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin'))
  );

CREATE TRIGGER trg_supplier_portal_settings_updated
  BEFORE UPDATE ON public.supplier_portal_settings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 2. Form config (versioned)
CREATE TABLE IF NOT EXISTS public.supplier_registration_form_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  version integer NOT NULL DEFAULT 1,
  is_published boolean NOT NULL DEFAULT false,
  schema jsonb NOT NULL DEFAULT '{"sections":[]}'::jsonb,
  updated_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (company_id, version)
);

CREATE UNIQUE INDEX IF NOT EXISTS supplier_form_config_one_published_per_company
  ON public.supplier_registration_form_config (company_id)
  WHERE is_published = true;

ALTER TABLE public.supplier_registration_form_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "form_config_company_read"
  ON public.supplier_registration_form_config FOR SELECT TO authenticated
  USING (public.can_access_company(company_id));

CREATE POLICY "form_config_admin_write"
  ON public.supplier_registration_form_config FOR ALL TO authenticated
  USING (
    public.can_access_company(company_id)
    AND (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin'))
  )
  WITH CHECK (
    public.can_access_company(company_id)
    AND (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin'))
  );

CREATE TRIGGER trg_supplier_form_config_updated
  BEFORE UPDATE ON public.supplier_registration_form_config
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 3. Public RPCs (no auth required)
CREATE OR REPLACE FUNCTION public.resolve_public_portal_company(_slug text)
RETURNS TABLE (id uuid, name text, code text, logo_url text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT c.id, c.name, c.code, c.logo_url
  FROM public.companies c
  WHERE lower(c.code) = lower(_slug)
    AND c.status = 'active'
  LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.resolve_public_portal_company(text) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.get_published_supplier_form(_slug text)
RETURNS TABLE (company_id uuid, company_name text, schema jsonb, version integer)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT c.id, c.name, f.schema, f.version
  FROM public.companies c
  LEFT JOIN public.supplier_registration_form_config f
    ON f.company_id = c.id AND f.is_published = true
  WHERE lower(c.code) = lower(_slug)
    AND c.status = 'active'
  LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.get_published_supplier_form(text) TO anon, authenticated;
