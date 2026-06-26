-- Costume Rental sub-module — Phase A: catalog foundation.
--
-- Dedicated, company-scoped tables (decoupled from warehouse inventory):
--   rental_categories     — hierarchical costume categories
--   rental_costumes       — the "style" (a kind of costume)
--   rental_costume_units  — individual physical pieces of a style
--
-- Reuses the app's standard idioms: company_id scoping, RLS via
-- can_access_company()/is_admin(), update_updated_at_column() trigger,
-- TEXT+CHECK statuses, and a generate_*_code() numbering RPC.

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. rental_categories
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.rental_categories (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name        text NOT NULL,
  code        text,
  parent_id   uuid REFERENCES public.rental_categories(id) ON DELETE SET NULL,
  description text,
  company_id  uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  created_by  uuid,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_rental_categories_company ON public.rental_categories(company_id);
CREATE INDEX IF NOT EXISTS idx_rental_categories_parent  ON public.rental_categories(parent_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. rental_costumes (the style)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.rental_costumes (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  costume_code      text NOT NULL UNIQUE,
  name              text NOT NULL,
  description       text,
  category_id       uuid REFERENCES public.rental_categories(id) ON DELETE SET NULL,
  size              text,
  color             text,
  gender            text,
  theme             text,
  brand             text,
  image_url         text,
  daily_rate        numeric(15,2) NOT NULL DEFAULT 0,
  flat_rate         numeric(15,2),
  security_deposit  numeric(15,2) NOT NULL DEFAULT 0,
  replacement_value numeric(15,2) NOT NULL DEFAULT 0,
  status            text NOT NULL DEFAULT 'active' CHECK (status IN ('active','inactive','retired')),
  company_id        uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  created_by        uuid,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_rental_costumes_company  ON public.rental_costumes(company_id);
CREATE INDEX IF NOT EXISTS idx_rental_costumes_category ON public.rental_costumes(category_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. rental_costume_units (a physical piece of a style)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.rental_costume_units (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  costume_id  uuid NOT NULL REFERENCES public.rental_costumes(id) ON DELETE CASCADE,
  unit_code   text NOT NULL,
  condition   text NOT NULL DEFAULT 'good'      CHECK (condition IN ('new','good','fair','needs_repair','retired')),
  status      text NOT NULL DEFAULT 'available' CHECK (status IN ('available','reserved','out','maintenance','retired')),
  notes       text,
  company_id  uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  created_by  uuid,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (costume_id, unit_code)
);
CREATE INDEX IF NOT EXISTS idx_rental_units_costume ON public.rental_costume_units(costume_id);
CREATE INDEX IF NOT EXISTS idx_rental_units_company ON public.rental_costume_units(company_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- updated_at triggers (reuse the standard function)
-- ─────────────────────────────────────────────────────────────────────────────
DROP TRIGGER IF EXISTS trg_rental_categories_updated_at ON public.rental_categories;
CREATE TRIGGER trg_rental_categories_updated_at
  BEFORE UPDATE ON public.rental_categories
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS trg_rental_costumes_updated_at ON public.rental_costumes;
CREATE TRIGGER trg_rental_costumes_updated_at
  BEFORE UPDATE ON public.rental_costumes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS trg_rental_units_updated_at ON public.rental_costume_units;
CREATE TRIGGER trg_rental_units_updated_at
  BEFORE UPDATE ON public.rental_costume_units
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ─────────────────────────────────────────────────────────────────────────────
-- Numbering: costume codes (CST-00001) and per-style unit codes (<code>-001)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.generate_costume_code()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  next_number integer;
BEGIN
  SELECT COALESCE(MAX(CAST(SUBSTRING(costume_code FROM 'CST-(.*)') AS integer)), 0) + 1
    INTO next_number
    FROM public.rental_costumes
   WHERE costume_code ~ '^CST-[0-9]+$';
  RETURN 'CST-' || LPAD(next_number::text, 5, '0');
END;
$$;

-- Auto-assign a unit_code per costume when not supplied: <costume_code>-NNN.
CREATE OR REPLACE FUNCTION public.set_rental_unit_code()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_costume_code text;
  v_seq integer;
BEGIN
  IF NEW.unit_code IS NOT NULL AND length(btrim(NEW.unit_code)) > 0 THEN
    RETURN NEW;
  END IF;
  SELECT costume_code INTO v_costume_code FROM public.rental_costumes WHERE id = NEW.costume_id;
  SELECT COALESCE(MAX(CAST(SUBSTRING(unit_code FROM '.*-([0-9]+)$') AS integer)), 0) + 1
    INTO v_seq
    FROM public.rental_costume_units
   WHERE costume_id = NEW.costume_id
     AND unit_code ~ '-[0-9]+$';
  NEW.unit_code := COALESCE(v_costume_code, 'UNIT') || '-' || LPAD(v_seq::text, 3, '0');
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_rental_unit_code ON public.rental_costume_units;
CREATE TRIGGER trg_rental_unit_code
  BEFORE INSERT ON public.rental_costume_units
  FOR EACH ROW EXECUTE FUNCTION public.set_rental_unit_code();

-- ─────────────────────────────────────────────────────────────────────────────
-- RLS — read/write within accessible companies; delete admin-only.
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.rental_categories     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rental_costumes        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rental_costume_units   ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['rental_categories','rental_costumes','rental_costume_units']
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I_select ON public.%I', t, t);
    EXECUTE format('DROP POLICY IF EXISTS %I_insert ON public.%I', t, t);
    EXECUTE format('DROP POLICY IF EXISTS %I_update ON public.%I', t, t);
    EXECUTE format('DROP POLICY IF EXISTS %I_delete ON public.%I', t, t);

    EXECUTE format($p$CREATE POLICY %I_select ON public.%I FOR SELECT TO authenticated
                      USING (public.can_access_company(company_id))$p$, t, t);
    EXECUTE format($p$CREATE POLICY %I_insert ON public.%I FOR INSERT TO authenticated
                      WITH CHECK (public.can_access_company(company_id))$p$, t, t);
    EXECUTE format($p$CREATE POLICY %I_update ON public.%I FOR UPDATE TO authenticated
                      USING (public.can_access_company(company_id))
                      WITH CHECK (public.can_access_company(company_id))$p$, t, t);
    EXECUTE format($p$CREATE POLICY %I_delete ON public.%I FOR DELETE TO authenticated
                      USING (public.is_admin(auth.uid()))$p$, t, t);
  END LOOP;
END$$;

GRANT EXECUTE ON FUNCTION public.generate_costume_code() TO authenticated;
