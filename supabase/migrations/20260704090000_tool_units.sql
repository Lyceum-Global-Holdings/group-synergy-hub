-- Tool Management modernization — Phase A: serialized units + per-unit history.
-- Hybrid model: warehouse_tools stays the tool TYPE master; high-value/calibrated
-- tools are serialized into individual tool_units (each with its own code, QR,
-- condition/status and an append-only event timeline). Bulk tools keep the qty
-- model untouched. For serialized tools, the type's total/available/issued counts
-- are derived from its units.

-- 1. Serialization + policy fields on the tool type master.
ALTER TABLE public.warehouse_tools
  ADD COLUMN IF NOT EXISTS is_serialized boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS calibration_required boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS calibration_interval_months integer,
  ADD COLUMN IF NOT EXISTS maintenance_interval_months integer,
  ADD COLUMN IF NOT EXISTS fixed_asset_id uuid;

-- 2. Individual serialized units.
CREATE TABLE IF NOT EXISTS public.tool_units (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tool_id uuid NOT NULL REFERENCES public.warehouse_tools(id) ON DELETE CASCADE,
  unit_code text UNIQUE,
  serial_number text,
  asset_tag text,
  status text NOT NULL DEFAULT 'in_service'
    CHECK (status IN ('in_service','issued','in_repair','in_calibration','retired','lost')),
  condition text NOT NULL DEFAULT 'good'
    CHECK (condition IN ('new','good','fair','needs_repair','retired')),
  location_id uuid REFERENCES public.warehouse_locations(id),
  bin_id uuid REFERENCES public.warehouse_bins(id),
  purchase_date date,
  purchase_cost numeric(15,2),
  warranty_expiry date,
  next_calibration_due date,
  next_maintenance_due date,
  notes text,
  company_id uuid REFERENCES public.companies(id),
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_tool_units_tool ON public.tool_units (tool_id);
CREATE INDEX IF NOT EXISTS idx_tool_units_company ON public.tool_units (company_id);
CREATE INDEX IF NOT EXISTS idx_tool_units_status ON public.tool_units (status);

-- 3. Append-only per-unit timeline.
CREATE TABLE IF NOT EXISTS public.tool_unit_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  unit_id uuid NOT NULL REFERENCES public.tool_units(id) ON DELETE CASCADE,
  event_type text NOT NULL
    CHECK (event_type IN ('registered','issued','returned','condition_change',
                          'calibration','maintenance','status_change','retired','lost')),
  event_date timestamptz NOT NULL DEFAULT now(),
  from_value text,
  to_value text,
  reference text,
  notes text,
  created_by uuid,
  company_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_tool_unit_events_unit ON public.tool_unit_events (unit_id, created_at DESC);

-- 4. Link a tool issue to a specific serialized unit (nullable — bulk issues stay unit-less).
ALTER TABLE public.tool_issues
  ADD COLUMN IF NOT EXISTS unit_id uuid REFERENCES public.tool_units(id);

-- 5. Auto unit_code = <tool_code>-NNN per tool (mirrors set_rental_unit_code).
CREATE OR REPLACE FUNCTION public.set_tool_unit_code()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_tool_code text;
  v_seq integer;
BEGIN
  IF NEW.unit_code IS NOT NULL AND length(btrim(NEW.unit_code)) > 0 THEN
    RETURN NEW;
  END IF;
  SELECT tool_code INTO v_tool_code FROM public.warehouse_tools WHERE id = NEW.tool_id;
  SELECT COALESCE(MAX(CAST(SUBSTRING(unit_code FROM '.*-([0-9]+)$') AS integer)), 0) + 1
    INTO v_seq
    FROM public.tool_units
   WHERE tool_id = NEW.tool_id AND unit_code ~ '-[0-9]+$';
  NEW.unit_code := COALESCE(v_tool_code, 'TOOL') || '-' || LPAD(v_seq::text, 3, '0');
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_tool_unit_code ON public.tool_units;
CREATE TRIGGER trg_tool_unit_code
  BEFORE INSERT ON public.tool_units
  FOR EACH ROW EXECUTE FUNCTION public.set_tool_unit_code();

-- 6. Recompute the serialized tool type's counts from its units.
CREATE OR REPLACE FUNCTION public.recompute_tool_counts(p_tool_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  UPDATE public.warehouse_tools t
     SET total_quantity     = sub.total,
         available_quantity = sub.avail,
         issued_quantity    = sub.issued,
         updated_at         = now()
    FROM (
      SELECT COUNT(*) FILTER (WHERE status NOT IN ('retired','lost')) AS total,
             COUNT(*) FILTER (WHERE status = 'in_service')            AS avail,
             COUNT(*) FILTER (WHERE status = 'issued')                AS issued
      FROM public.tool_units WHERE tool_id = p_tool_id
    ) sub
   WHERE t.id = p_tool_id AND t.is_serialized = true;
END;
$$;

-- 7. Log unit lifecycle events + keep parent counts in sync.
CREATE OR REPLACE FUNCTION public.trg_tool_unit_log()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_tool uuid;
  v_actor uuid := auth.uid();
BEGIN
  IF TG_OP = 'INSERT' THEN
    -- First unit auto-flags the tool type as serialized.
    UPDATE public.warehouse_tools SET is_serialized = true, updated_at = now()
     WHERE id = NEW.tool_id AND is_serialized = false;
    INSERT INTO public.tool_unit_events(unit_id, event_type, to_value, notes, created_by, company_id)
      VALUES (NEW.id, 'registered', NEW.status, 'Unit registered', COALESCE(v_actor, NEW.created_by), NEW.company_id);
    v_tool := NEW.tool_id;
  ELSIF TG_OP = 'UPDATE' THEN
    IF NEW.status IS DISTINCT FROM OLD.status THEN
      INSERT INTO public.tool_unit_events(unit_id, event_type, from_value, to_value, created_by, company_id)
        VALUES (NEW.id, 'status_change', OLD.status, NEW.status, COALESCE(v_actor, NEW.created_by), NEW.company_id);
    END IF;
    IF NEW.condition IS DISTINCT FROM OLD.condition THEN
      INSERT INTO public.tool_unit_events(unit_id, event_type, from_value, to_value, created_by, company_id)
        VALUES (NEW.id, 'condition_change', OLD.condition, NEW.condition, COALESCE(v_actor, NEW.created_by), NEW.company_id);
    END IF;
    v_tool := NEW.tool_id;
  ELSE
    v_tool := OLD.tool_id;
  END IF;
  PERFORM public.recompute_tool_counts(v_tool);
  RETURN COALESCE(NEW, OLD);
END;
$$;
DROP TRIGGER IF EXISTS trg_tool_unit_log ON public.tool_units;
CREATE TRIGGER trg_tool_unit_log
  AFTER INSERT OR UPDATE OR DELETE ON public.tool_units
  FOR EACH ROW EXECUTE FUNCTION public.trg_tool_unit_log();

-- 8. updated_at.
DROP TRIGGER IF EXISTS trg_tool_units_updated_at ON public.tool_units;
CREATE TRIGGER trg_tool_units_updated_at
  BEFORE UPDATE ON public.tool_units
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 9. RLS — read/write within accessible companies (mirrors costume rental).
ALTER TABLE public.tool_units       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tool_unit_events ENABLE ROW LEVEL SECURITY;
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['tool_units','tool_unit_events']
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
