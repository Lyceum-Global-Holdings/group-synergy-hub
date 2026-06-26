-- Costume Rental — Phase C: checkout, return, deposits & fees.
--
-- checkout: assign specific physical units to each booked line, mark them 'out',
--           order -> checked_out.
-- return:   record per-unit condition back in, free units, compute late fee
--           (overdue days x daily rental total) + a manual damage fee, and
--           deposit_refund = deposit_total - late_fee - damage_fee (>= 0).
-- complete: settle a returned order.

CREATE TABLE IF NOT EXISTS public.rental_unit_assignments (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_item_id  uuid NOT NULL REFERENCES public.rental_order_items(id) ON DELETE CASCADE,
  unit_id        uuid NOT NULL REFERENCES public.rental_costume_units(id) ON DELETE RESTRICT,
  condition_out  text NOT NULL DEFAULT 'good' CHECK (condition_out IN ('new','good','fair','needs_repair','retired')),
  condition_in   text          CHECK (condition_in IN ('new','good','fair','needs_repair','retired')),
  returned       boolean NOT NULL DEFAULT false,
  damage_notes   text,
  company_id     uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_rua_order_item ON public.rental_unit_assignments(order_item_id);
CREATE INDEX IF NOT EXISTS idx_rua_unit       ON public.rental_unit_assignments(unit_id);

DROP TRIGGER IF EXISTS trg_rua_updated_at ON public.rental_unit_assignments;
CREATE TRIGGER trg_rua_updated_at BEFORE UPDATE ON public.rental_unit_assignments
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.rental_unit_assignments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS rua_select ON public.rental_unit_assignments;
DROP POLICY IF EXISTS rua_insert ON public.rental_unit_assignments;
DROP POLICY IF EXISTS rua_update ON public.rental_unit_assignments;
DROP POLICY IF EXISTS rua_delete ON public.rental_unit_assignments;
CREATE POLICY rua_select ON public.rental_unit_assignments FOR SELECT TO authenticated
  USING (public.can_access_company(company_id));
CREATE POLICY rua_insert ON public.rental_unit_assignments FOR INSERT TO authenticated
  WITH CHECK (public.can_access_company(company_id));
CREATE POLICY rua_update ON public.rental_unit_assignments FOR UPDATE TO authenticated
  USING (public.can_access_company(company_id)) WITH CHECK (public.can_access_company(company_id));
CREATE POLICY rua_delete ON public.rental_unit_assignments FOR DELETE TO authenticated
  USING (public.is_admin(auth.uid()));

-- ─────────────────────────────────────────────────────────────────────────────
-- checkout_rental_order(p_id, p_assignments)
--   p_assignments = [{ "order_item_id": uuid, "unit_id": uuid, "condition_out": text }]
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.checkout_rental_order(p_id uuid, p_assignments jsonb)
RETURNS public.rental_orders
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_order public.rental_orders;
  v_uid   uuid := auth.uid();
  v_a     jsonb;
  v_item  RECORD;
  v_unit  public.rental_costume_units;
  v_cond  text;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Authentication required'; END IF;
  IF NOT public.is_admin(v_uid) THEN RAISE EXCEPTION 'Only admins can check out a rental'; END IF;

  SELECT * INTO v_order FROM public.rental_orders WHERE id = p_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Rental order % not found', p_id; END IF;
  IF v_order.status <> 'approved' THEN
    RAISE EXCEPTION 'Rental % is not approved (status: %); cannot check out', v_order.rental_number, v_order.status;
  END IF;

  -- Every booked line must be fully assigned.
  FOR v_item IN
    SELECT oi.id, oi.quantity, oi.costume_id, rc.name
      FROM public.rental_order_items oi JOIN public.rental_costumes rc ON rc.id = oi.costume_id
     WHERE oi.rental_order_id = p_id
  LOOP
    IF (SELECT count(*) FROM jsonb_array_elements(p_assignments) e
          WHERE (e->>'order_item_id')::uuid = v_item.id) <> v_item.quantity THEN
      RAISE EXCEPTION 'Assign exactly % unit(s) for "%"', v_item.quantity, v_item.name;
    END IF;
  END LOOP;

  -- Validate and assign each unit.
  FOR v_a IN SELECT * FROM jsonb_array_elements(p_assignments)
  LOOP
    SELECT * INTO v_item FROM public.rental_order_items WHERE id = (v_a->>'order_item_id')::uuid AND rental_order_id = p_id;
    IF NOT FOUND THEN RAISE EXCEPTION 'Invalid order_item_id in assignments'; END IF;

    SELECT * INTO v_unit FROM public.rental_costume_units WHERE id = (v_a->>'unit_id')::uuid FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Unit not found'; END IF;
    IF v_unit.costume_id <> v_item.costume_id THEN
      RAISE EXCEPTION 'Unit % does not belong to the booked costume', v_unit.unit_code;
    END IF;
    IF v_unit.status <> 'available' THEN
      RAISE EXCEPTION 'Unit % is not available (status: %)', v_unit.unit_code, v_unit.status;
    END IF;

    v_cond := COALESCE(v_a->>'condition_out', v_unit.condition);
    INSERT INTO public.rental_unit_assignments(order_item_id, unit_id, condition_out, company_id)
    VALUES (v_item.id, v_unit.id, v_cond, v_order.company_id);

    UPDATE public.rental_costume_units SET status = 'out', updated_at = now() WHERE id = v_unit.id;
  END LOOP;

  UPDATE public.rental_orders
     SET status = 'checked_out', checked_out_by = v_uid, checked_out_at = now(), updated_at = now()
   WHERE id = p_id RETURNING * INTO v_order;
  RETURN v_order;
END;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- return_rental_order(p_id, p_returns, p_damage_fee)
--   p_returns = [{ "assignment_id": uuid, "condition_in": text, "damage_notes": text }]
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.return_rental_order(
  p_id uuid, p_returns jsonb DEFAULT '[]'::jsonb, p_damage_fee numeric DEFAULT 0
)
RETURNS public.rental_orders
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_order public.rental_orders;
  v_uid   uuid := auth.uid();
  v_r     jsonb;
  v_overdue_days integer;
  v_daily_total  numeric(15,2);
  v_late_fee     numeric(15,2);
  v_damage_fee   numeric(15,2) := COALESCE(p_damage_fee, 0);
  v_cond  text;
  v_new_status text;
  v_unit  uuid;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Authentication required'; END IF;
  IF NOT public.is_admin(v_uid) THEN RAISE EXCEPTION 'Only admins can process a return'; END IF;

  SELECT * INTO v_order FROM public.rental_orders WHERE id = p_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Rental order % not found', p_id; END IF;
  IF v_order.status <> 'checked_out' THEN
    RAISE EXCEPTION 'Rental % is not checked out (status: %)', v_order.rental_number, v_order.status;
  END IF;

  -- Record condition-in per assignment and free each physical unit.
  FOR v_r IN SELECT * FROM jsonb_array_elements(p_returns)
  LOOP
    v_cond := COALESCE(v_r->>'condition_in', 'good');
    SELECT unit_id INTO v_unit FROM public.rental_unit_assignments
      WHERE id = (v_r->>'assignment_id')::uuid AND company_id = v_order.company_id;
    IF v_unit IS NULL THEN CONTINUE; END IF;

    UPDATE public.rental_unit_assignments
       SET condition_in = v_cond, returned = true,
           damage_notes = NULLIF(v_r->>'damage_notes',''), updated_at = now()
     WHERE id = (v_r->>'assignment_id')::uuid;

    v_new_status := CASE
      WHEN v_cond = 'retired' THEN 'retired'
      WHEN v_cond = 'needs_repair' THEN 'maintenance'
      ELSE 'available' END;
    UPDATE public.rental_costume_units
       SET status = v_new_status, condition = v_cond, updated_at = now()
     WHERE id = v_unit;
  END LOOP;

  -- Any assignments not explicitly returned are still freed (returned in bulk).
  UPDATE public.rental_unit_assignments SET returned = true, updated_at = now()
   WHERE order_item_id IN (SELECT id FROM public.rental_order_items WHERE rental_order_id = p_id)
     AND returned = false;
  UPDATE public.rental_costume_units SET status = 'available', updated_at = now()
   WHERE status = 'out' AND id IN (
     SELECT a.unit_id FROM public.rental_unit_assignments a
       JOIN public.rental_order_items oi ON oi.id = a.order_item_id
      WHERE oi.rental_order_id = p_id);

  -- Late fee = overdue days x daily rental total.
  v_overdue_days := GREATEST(0, CURRENT_DATE - v_order.due_date);
  SELECT COALESCE(SUM(daily_rate * quantity), 0) INTO v_daily_total
    FROM public.rental_order_items WHERE rental_order_id = p_id;
  v_late_fee := v_overdue_days * v_daily_total;

  UPDATE public.rental_orders
     SET status = 'returned',
         actual_return_date = CURRENT_DATE,
         late_fee = v_late_fee,
         damage_fee = v_damage_fee,
         deposit_refund = GREATEST(0, deposit_total - v_late_fee - v_damage_fee),
         returned_by = v_uid, returned_at = now(), updated_at = now()
   WHERE id = p_id RETURNING * INTO v_order;
  RETURN v_order;
END;
$$;

CREATE OR REPLACE FUNCTION public.complete_rental_order(p_id uuid)
RETURNS public.rental_orders
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE v_order public.rental_orders;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Authentication required'; END IF;
  SELECT * INTO v_order FROM public.rental_orders WHERE id = p_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Rental order % not found', p_id; END IF;
  IF v_order.status <> 'returned' THEN
    RAISE EXCEPTION 'Rental % is not returned (status: %)', v_order.rental_number, v_order.status;
  END IF;
  UPDATE public.rental_orders SET status = 'completed', updated_at = now()
   WHERE id = p_id RETURNING * INTO v_order;
  RETURN v_order;
END;
$$;

-- Refine availability: a unit in 'maintenance' (or 'retired') is not bookable.
-- 'out' units stay in the pool because their date bookings are subtracted below.
CREATE OR REPLACE FUNCTION public.rental_costume_available_units(
  p_costume_id uuid, p_from date, p_to date, p_exclude_order uuid DEFAULT NULL
)
RETURNS integer
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_total  integer;
  v_booked integer;
BEGIN
  SELECT count(*) INTO v_total
    FROM public.rental_costume_units
   WHERE costume_id = p_costume_id AND status NOT IN ('retired','maintenance');

  SELECT COALESCE(SUM(oi.quantity), 0) INTO v_booked
    FROM public.rental_order_items oi
    JOIN public.rental_orders o ON o.id = oi.rental_order_id
   WHERE oi.costume_id = p_costume_id
     AND o.status IN ('pending_approval','approved','checked_out')
     AND (p_exclude_order IS NULL OR o.id <> p_exclude_order)
     AND o.pickup_date <= p_to
     AND o.due_date   >= p_from;

  RETURN v_total - v_booked;
END;
$$;

GRANT EXECUTE ON FUNCTION public.checkout_rental_order(uuid,jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.return_rental_order(uuid,jsonb,numeric) TO authenticated;
GRANT EXECUTE ON FUNCTION public.complete_rental_order(uuid) TO authenticated;
