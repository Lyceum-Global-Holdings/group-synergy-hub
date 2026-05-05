
-- 1. Add srn_number columns
ALTER TABLE public.material_requests ADD COLUMN IF NOT EXISTS srn_number text;
ALTER TABLE public.material_issue_notes ADD COLUMN IF NOT EXISTS srn_number text;
ALTER TABLE public.material_return_notes ADD COLUMN IF NOT EXISTS srn_number text;
ALTER TABLE public.material_issue_items ADD COLUMN IF NOT EXISTS srn_number text;
ALTER TABLE public.material_request_items ADD COLUMN IF NOT EXISTS srn_number text;

-- 2. Counter table
CREATE TABLE IF NOT EXISTS public.srn_counters (
  company_id uuid NOT NULL,
  year integer NOT NULL,
  last_seq integer NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (company_id, year)
);

ALTER TABLE public.srn_counters ENABLE ROW LEVEL SECURITY;

-- No user policies: only SECURITY DEFINER functions modify this table.

-- 3. Generator function
CREATE OR REPLACE FUNCTION public.generate_srn_number(_company_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _year integer := EXTRACT(YEAR FROM now())::integer;
  _seq integer;
BEGIN
  IF _company_id IS NULL THEN
    RAISE EXCEPTION 'company_id is required to generate SRN number';
  END IF;

  INSERT INTO public.srn_counters (company_id, year, last_seq)
  VALUES (_company_id, _year, 1)
  ON CONFLICT (company_id, year)
  DO UPDATE SET last_seq = public.srn_counters.last_seq + 1,
                updated_at = now()
  RETURNING last_seq INTO _seq;

  RETURN 'SRN-' || _year::text || '-' || LPAD(_seq::text, 6, '0');
END;
$$;

-- 4. Existence check
CREATE OR REPLACE FUNCTION public.srn_number_exists(
  _company_id uuid,
  _srn_number text,
  _exclude_id uuid DEFAULT NULL
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.material_requests
     WHERE company_id = _company_id AND srn_number = _srn_number
       AND (_exclude_id IS NULL OR id <> _exclude_id)
    UNION ALL
    SELECT 1 FROM public.material_issue_notes
     WHERE company_id = _company_id AND srn_number = _srn_number
       AND (_exclude_id IS NULL OR id <> _exclude_id)
    UNION ALL
    SELECT 1 FROM public.material_return_notes
     WHERE company_id = _company_id AND srn_number = _srn_number
       AND (_exclude_id IS NULL OR id <> _exclude_id)
  );
$$;

-- 5. Validation trigger function
CREATE OR REPLACE FUNCTION public.validate_srn_number()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _exists boolean;
BEGIN
  IF NEW.srn_number IS NULL OR NEW.srn_number = '' THEN
    NEW.srn_number := NULL;
    RETURN NEW;
  END IF;

  -- Format validation
  IF NEW.srn_number !~ '^SRN-\d{4}-\d{6}$' THEN
    RAISE EXCEPTION 'Invalid SRN format. Expected SRN-YYYY-NNNNNN, got %', NEW.srn_number;
  END IF;

  -- Uniqueness check across the three header tables (per company)
  IF NEW.company_id IS NOT NULL THEN
    SELECT EXISTS (
      SELECT 1 FROM public.material_requests
       WHERE company_id = NEW.company_id AND srn_number = NEW.srn_number
         AND id <> NEW.id
      UNION ALL
      SELECT 1 FROM public.material_issue_notes
       WHERE company_id = NEW.company_id AND srn_number = NEW.srn_number
         AND id <> NEW.id
      UNION ALL
      SELECT 1 FROM public.material_return_notes
       WHERE company_id = NEW.company_id AND srn_number = NEW.srn_number
         AND id <> NEW.id
    ) INTO _exists;

    IF _exists THEN
      RAISE EXCEPTION 'SRN number % already exists for this company', NEW.srn_number;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

-- 6. Triggers on header tables
DROP TRIGGER IF EXISTS trg_validate_srn_material_requests ON public.material_requests;
CREATE TRIGGER trg_validate_srn_material_requests
  BEFORE INSERT OR UPDATE OF srn_number ON public.material_requests
  FOR EACH ROW EXECUTE FUNCTION public.validate_srn_number();

DROP TRIGGER IF EXISTS trg_validate_srn_material_issue_notes ON public.material_issue_notes;
CREATE TRIGGER trg_validate_srn_material_issue_notes
  BEFORE INSERT OR UPDATE OF srn_number ON public.material_issue_notes
  FOR EACH ROW EXECUTE FUNCTION public.validate_srn_number();

DROP TRIGGER IF EXISTS trg_validate_srn_material_return_notes ON public.material_return_notes;
CREATE TRIGGER trg_validate_srn_material_return_notes
  BEFORE INSERT OR UPDATE OF srn_number ON public.material_return_notes
  FOR EACH ROW EXECUTE FUNCTION public.validate_srn_number();

-- 7. Indexes for SRN lookup
CREATE INDEX IF NOT EXISTS idx_material_requests_srn
  ON public.material_requests (company_id, srn_number)
  WHERE srn_number IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_material_issue_notes_srn
  ON public.material_issue_notes (company_id, srn_number)
  WHERE srn_number IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_material_return_notes_srn
  ON public.material_return_notes (company_id, srn_number)
  WHERE srn_number IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_material_issue_items_srn
  ON public.material_issue_items (srn_number)
  WHERE srn_number IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_material_request_items_srn
  ON public.material_request_items (srn_number)
  WHERE srn_number IS NOT NULL;
