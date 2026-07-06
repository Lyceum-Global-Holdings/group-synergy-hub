-- Costume unit lifecycle & stock management (ISO 55000-aligned).
--
-- Adds a controlled status state-machine, an append-only per-unit event history,
-- a maintenance/service log, and disposal metadata for costume units — the same
-- proven pattern used by Tool Management (tool_unit_events / tool_maintenance).
--
-- • status gains 'cleaning' (post-return laundry/dry-clean) and 'lost'.
-- • A trigger logs every status/condition change (incl. checkout/return, which
--   already UPDATE the unit) so the timeline is complete with no extra wiring.
-- • change_costume_unit_status()/dispose_costume_unit()/record_costume_unit_maintenance()
--   are SECURITY DEFINER RPCs that validate transitions and capture a reason.

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. Extend the unit status set (+ cleaning, + lost) and add disposal / asset
--    register fields.
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.rental_costume_units
  DROP CONSTRAINT IF EXISTS rental_costume_units_status_check;
ALTER TABLE public.rental_costume_units
  ADD CONSTRAINT rental_costume_units_status_check
  CHECK (status IN ('available','reserved','out','cleaning','maintenance','retired','lost'));

ALTER TABLE public.rental_costume_units
  ADD COLUMN IF NOT EXISTS acquired_date     date,
  ADD COLUMN IF NOT EXISTS acquisition_cost  numeric(15,2),
  ADD COLUMN IF NOT EXISTS disposed_at       timestamptz,
  ADD COLUMN IF NOT EXISTS disposal_reason   text,
  ADD COLUMN IF NOT EXISTS disposal_method   text,
  ADD COLUMN IF NOT EXISTS disposal_value    numeric(15,2);

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. Append-only event history (per-unit timeline).
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.rental_unit_events (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  unit_id     uuid NOT NULL REFERENCES public.rental_costume_units(id) ON DELETE CASCADE,
  event_type  text NOT NULL
    CHECK (event_type IN ('registered','status_change','condition_change','maintenance','disposed','note')),
  event_date  timestamptz NOT NULL DEFAULT now(),
  from_value  text,
  to_value    text,
  reference   text,
  notes       text,
  created_by  uuid,
  company_id  uuid,
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_rental_unit_events_unit
  ON public.rental_unit_events (unit_id, created_at DESC);

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. Maintenance / service log (ISO 55000): cleaning, repair, alteration, inspection.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.rental_unit_maintenance (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  unit_id           uuid NOT NULL REFERENCES public.rental_costume_units(id) ON DELETE CASCADE,
  maintenance_type  text NOT NULL DEFAULT 'repair'
    CHECK (maintenance_type IN ('cleaning','repair','alteration','inspection')),
  maintenance_date  date NOT NULL DEFAULT current_date,
  performed_by      text,
  provider          text,
  cost              numeric(15,2) NOT NULL DEFAULT 0,
  description       text,
  out_of_service    boolean NOT NULL DEFAULT true,
  company_id        uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  created_by        uuid,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_rental_unit_maintenance_unit
  ON public.rental_unit_maintenance (unit_id, maintenance_date DESC);

DROP TRIGGER IF EXISTS trg_rental_unit_maint_updated_at ON public.rental_unit_maintenance;
CREATE TRIGGER trg_rental_unit_maint_updated_at
  BEFORE UPDATE ON public.rental_unit_maintenance
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. Auto-log unit status/condition changes. RPCs pass a human reason through a
--    transaction-local GUC (app.rental_unit_note) so it lands on the event.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.trg_rental_unit_log()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_actor uuid := auth.uid();
  v_note  text := NULLIF(current_setting('app.rental_unit_note', true), '');
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.rental_unit_events(unit_id, event_type, to_value, notes, created_by, company_id)
      VALUES (NEW.id, 'registered', NEW.status, 'Unit registered', COALESCE(v_actor, NEW.created_by), NEW.company_id);
  ELSIF TG_OP = 'UPDATE' THEN
    IF NEW.status IS DISTINCT FROM OLD.status THEN
      INSERT INTO public.rental_unit_events(unit_id, event_type, from_value, to_value, notes, created_by, company_id)
        VALUES (NEW.id,
                CASE WHEN NEW.status = 'retired' AND NEW.disposed_at IS NOT NULL THEN 'disposed' ELSE 'status_change' END,
                OLD.status, NEW.status, v_note, COALESCE(v_actor, NEW.created_by), NEW.company_id);
    END IF;
    IF NEW.condition IS DISTINCT FROM OLD.condition THEN
      INSERT INTO public.rental_unit_events(unit_id, event_type, from_value, to_value, notes, created_by, company_id)
        VALUES (NEW.id, 'condition_change', OLD.condition, NEW.condition, v_note, COALESCE(v_actor, NEW.created_by), NEW.company_id);
    END IF;
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$;
DROP TRIGGER IF EXISTS trg_rental_unit_log ON public.rental_costume_units;
CREATE TRIGGER trg_rental_unit_log
  AFTER INSERT OR UPDATE ON public.rental_costume_units
  FOR EACH ROW EXECUTE FUNCTION public.trg_rental_unit_log();

-- ─────────────────────────────────────────────────────────────────────────────
-- 5. Validated status transition. Blocks illegal moves and protects checked-out
--    / terminal units. Records the caller's reason on the auto-logged event.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.change_costume_unit_status(
  p_unit_id   uuid,
  p_new_status text,
  p_condition  text DEFAULT NULL,
  p_reason     text DEFAULT NULL
) RETURNS public.rental_costume_units
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_unit public.rental_costume_units;
  v_ok   boolean;
BEGIN
  SELECT * INTO v_unit FROM public.rental_costume_units WHERE id = p_unit_id FOR UPDATE;
  IF v_unit IS NULL THEN RAISE EXCEPTION 'Unit not found'; END IF;
  IF NOT public.can_access_company(v_unit.company_id) THEN
    RAISE EXCEPTION 'Not authorised for this unit';
  END IF;

  -- Allowed transitions (from -> to). 'out' is owned by checkout/return; only a
  -- loss can be recorded against it here. 'retired' is terminal.
  v_ok := CASE v_unit.status
    WHEN 'available'   THEN p_new_status IN ('reserved','cleaning','maintenance','retired','lost')
    WHEN 'reserved'    THEN p_new_status IN ('available','cleaning','maintenance','lost')
    WHEN 'out'         THEN p_new_status IN ('lost')
    WHEN 'cleaning'    THEN p_new_status IN ('available','maintenance','retired','lost')
    WHEN 'maintenance' THEN p_new_status IN ('available','cleaning','retired','lost')
    WHEN 'lost'        THEN p_new_status IN ('available','retired')
    WHEN 'retired'     THEN false
    ELSE false END;

  IF v_unit.status = p_new_status THEN
    v_ok := true;  -- allow condition-only updates
  END IF;
  IF NOT v_ok THEN
    RAISE EXCEPTION 'Cannot move unit % from % to %', v_unit.unit_code, v_unit.status, p_new_status;
  END IF;

  -- Reason is carried onto the auto-logged event via the GUC (not onto the unit,
  -- so a meaningful unit note is never clobbered).
  PERFORM set_config('app.rental_unit_note', COALESCE(p_reason, ''), true);
  UPDATE public.rental_costume_units
     SET status    = p_new_status,
         condition = COALESCE(p_condition, condition),
         updated_at = now()
   WHERE id = p_unit_id
   RETURNING * INTO v_unit;
  RETURN v_unit;
END;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 6. Disposal / decommission (ISO 55001 §): terminal 'retired' + disposal record.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.dispose_costume_unit(
  p_unit_id  uuid,
  p_reason   text,
  p_method   text DEFAULT NULL,
  p_value    numeric DEFAULT NULL
) RETURNS public.rental_costume_units
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_unit public.rental_costume_units;
BEGIN
  SELECT * INTO v_unit FROM public.rental_costume_units WHERE id = p_unit_id FOR UPDATE;
  IF v_unit IS NULL THEN RAISE EXCEPTION 'Unit not found'; END IF;
  IF NOT public.can_access_company(v_unit.company_id) THEN
    RAISE EXCEPTION 'Not authorised for this unit';
  END IF;
  IF v_unit.status = 'out' THEN
    RAISE EXCEPTION 'Unit % is checked out; return it before disposal', v_unit.unit_code;
  END IF;
  IF v_unit.status = 'retired' THEN
    RAISE EXCEPTION 'Unit % is already retired', v_unit.unit_code;
  END IF;

  PERFORM set_config('app.rental_unit_note', COALESCE(p_reason, 'Disposed'), true);
  UPDATE public.rental_costume_units
     SET status          = 'retired',
         condition       = 'retired',
         disposed_at     = now(),
         disposal_reason = p_reason,
         disposal_method = p_method,
         disposal_value  = p_value,
         updated_at      = now()
   WHERE id = p_unit_id
   RETURNING * INTO v_unit;
  RETURN v_unit;
END;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 7. Record maintenance/service and (optionally) move the unit in/out of service.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.record_costume_unit_maintenance(
  p_unit_id      uuid,
  p_type         text,
  p_date         date DEFAULT current_date,
  p_performed_by text DEFAULT NULL,
  p_provider     text DEFAULT NULL,
  p_cost         numeric DEFAULT 0,
  p_description  text DEFAULT NULL,
  p_new_status   text DEFAULT NULL,   -- e.g. move to 'maintenance'/'cleaning' or back to 'available'
  p_condition    text DEFAULT NULL
) RETURNS public.rental_unit_maintenance
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_unit public.rental_costume_units;
  v_rec  public.rental_unit_maintenance;
BEGIN
  SELECT * INTO v_unit FROM public.rental_costume_units WHERE id = p_unit_id FOR UPDATE;
  IF v_unit IS NULL THEN RAISE EXCEPTION 'Unit not found'; END IF;
  IF NOT public.can_access_company(v_unit.company_id) THEN
    RAISE EXCEPTION 'Not authorised for this unit';
  END IF;

  INSERT INTO public.rental_unit_maintenance
    (unit_id, maintenance_type, maintenance_date, performed_by, provider, cost, description,
     out_of_service, company_id, created_by)
  VALUES
    (p_unit_id, p_type, COALESCE(p_date, current_date), p_performed_by, p_provider,
     COALESCE(p_cost, 0), p_description,
     COALESCE(p_new_status, v_unit.status) IN ('maintenance','cleaning'),
     v_unit.company_id, auth.uid())
  RETURNING * INTO v_rec;

  -- Timeline entry for the service itself.
  INSERT INTO public.rental_unit_events(unit_id, event_type, to_value, reference, notes, created_by, company_id)
    VALUES (p_unit_id, 'maintenance', p_type, NULLIF(p_provider,''),
            COALESCE(p_description, initcap(p_type)), auth.uid(), v_unit.company_id);

  -- Optional status move (validated) — skips if unit is checked out.
  IF p_new_status IS NOT NULL AND p_new_status <> v_unit.status AND v_unit.status <> 'out' THEN
    PERFORM public.change_costume_unit_status(p_unit_id, p_new_status, p_condition,
              COALESCE(p_description, initcap(p_type)));
  ELSIF p_condition IS NOT NULL AND p_condition <> v_unit.condition THEN
    PERFORM set_config('app.rental_unit_note', COALESCE(p_description, initcap(p_type)), true);
    UPDATE public.rental_costume_units SET condition = p_condition, updated_at = now() WHERE id = p_unit_id;
  END IF;

  RETURN v_rec;
END;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 8. RLS for the two new tables (read/write within accessible companies).
-- ─────────────────────────────────────────────────────────────────────────────
DO $do$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['rental_unit_events','rental_unit_maintenance'] LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
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
                      USING (public.is_admin())$p$, t, t);
  END LOOP;
END $do$;

GRANT EXECUTE ON FUNCTION public.change_costume_unit_status(uuid, text, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.dispose_costume_unit(uuid, text, text, numeric) TO authenticated;
GRANT EXECUTE ON FUNCTION public.record_costume_unit_maintenance(uuid, text, date, text, text, numeric, text, text, text) TO authenticated;
