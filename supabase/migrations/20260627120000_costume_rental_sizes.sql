-- Costume Rental — multiple sizes per costume.
--
-- A costume "style" spans several sizes; each physical unit carries its own
-- size, and a rental line requests a specific size. Availability, over-booking
-- and checkout all become size-aware. "" (empty) = unspecified size.

-- Size on units (backfilled from the costume's existing size) and on lines.
ALTER TABLE public.rental_costume_units  ADD COLUMN IF NOT EXISTS size text NOT NULL DEFAULT '';
ALTER TABLE public.rental_order_items    ADD COLUMN IF NOT EXISTS size text NOT NULL DEFAULT '';

UPDATE public.rental_costume_units u
   SET size = COALESCE((SELECT c.size FROM public.rental_costumes c WHERE c.id = u.costume_id), '')
 WHERE u.size = '';

CREATE INDEX IF NOT EXISTS idx_rental_units_costume_size ON public.rental_costume_units(costume_id, size);

-- ─────────────────────────────────────────────────────────────────────────────
-- Size-aware availability (replaces the 4-arg version).
-- p_size NULL → all sizes (aggregate); p_size = '' or 'M' → that exact size.
-- ─────────────────────────────────────────────────────────────────────────────
DROP FUNCTION IF EXISTS public.rental_costume_available_units(uuid, date, date, uuid);

CREATE OR REPLACE FUNCTION public.rental_costume_available_units(
  p_costume_id uuid, p_from date, p_to date,
  p_exclude_order uuid DEFAULT NULL, p_size text DEFAULT NULL
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
   WHERE costume_id = p_costume_id
     AND status NOT IN ('retired','maintenance')
     AND (p_size IS NULL OR size = p_size);

  SELECT COALESCE(SUM(oi.quantity), 0) INTO v_booked
    FROM public.rental_order_items oi
    JOIN public.rental_orders o ON o.id = oi.rental_order_id
   WHERE oi.costume_id = p_costume_id
     AND o.status IN ('pending_approval','approved','checked_out')
     AND (p_exclude_order IS NULL OR o.id <> p_exclude_order)
     AND o.pickup_date <= p_to
     AND o.due_date   >= p_from
     AND (p_size IS NULL OR oi.size = p_size);

  RETURN v_total - v_booked;
END;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- Submit: size-aware over-booking check (per costume + size).
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.submit_rental_for_approval(p_id uuid)
RETURNS public.rental_orders
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_order public.rental_orders;
  v_item  RECORD;
  v_avail integer;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Authentication required'; END IF;

  SELECT * INTO v_order FROM public.rental_orders WHERE id = p_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Rental order % not found', p_id; END IF;
  IF v_order.status <> 'draft' THEN
    RAISE EXCEPTION 'Rental % is not a draft (status: %)', v_order.rental_number, v_order.status;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.rental_order_items WHERE rental_order_id = p_id) THEN
    RAISE EXCEPTION 'Rental % has no line items', v_order.rental_number;
  END IF;

  FOR v_item IN
    SELECT oi.costume_id, oi.quantity, oi.size, rc.name
      FROM public.rental_order_items oi
      JOIN public.rental_costumes rc ON rc.id = oi.costume_id
     WHERE oi.rental_order_id = p_id
  LOOP
    PERFORM 1 FROM public.rental_costumes WHERE id = v_item.costume_id FOR UPDATE;
    v_avail := public.rental_costume_available_units(
                 v_item.costume_id, v_order.pickup_date, v_order.due_date, p_id, v_item.size);
    IF v_item.quantity > v_avail THEN
      RAISE EXCEPTION 'Not enough units of "%"%for % to %: requested %, available %',
        v_item.name,
        CASE WHEN v_item.size <> '' THEN ' (size ' || v_item.size || ') ' ELSE ' ' END,
        v_order.pickup_date, v_order.due_date, v_item.quantity, v_avail;
    END IF;
  END LOOP;

  UPDATE public.rental_orders
     SET status = 'pending_approval', pending_approval = true, updated_at = now()
   WHERE id = p_id
  RETURNING * INTO v_order;
  RETURN v_order;
END;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- Checkout: assign units matching the line's costume AND size.
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
  v_item  public.rental_order_items;
  v_unit  public.rental_costume_units;
  v_cond  text;
  v_name  text;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Authentication required'; END IF;
  IF NOT public.is_admin(v_uid) THEN RAISE EXCEPTION 'Only admins can check out a rental'; END IF;

  SELECT * INTO v_order FROM public.rental_orders WHERE id = p_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Rental order % not found', p_id; END IF;
  IF v_order.status <> 'approved' THEN
    RAISE EXCEPTION 'Rental % is not approved (status: %); cannot check out', v_order.rental_number, v_order.status;
  END IF;

  FOR v_item IN SELECT * FROM public.rental_order_items WHERE rental_order_id = p_id
  LOOP
    SELECT name INTO v_name FROM public.rental_costumes WHERE id = v_item.costume_id;
    IF (SELECT count(*) FROM jsonb_array_elements(p_assignments) e
          WHERE (e->>'order_item_id')::uuid = v_item.id) <> v_item.quantity THEN
      RAISE EXCEPTION 'Assign exactly % unit(s) for "%"', v_item.quantity, v_name;
    END IF;
  END LOOP;

  FOR v_a IN SELECT * FROM jsonb_array_elements(p_assignments)
  LOOP
    SELECT * INTO v_item FROM public.rental_order_items WHERE id = (v_a->>'order_item_id')::uuid AND rental_order_id = p_id;
    IF NOT FOUND THEN RAISE EXCEPTION 'Invalid order_item_id in assignments'; END IF;

    SELECT * INTO v_unit FROM public.rental_costume_units WHERE id = (v_a->>'unit_id')::uuid FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Unit not found'; END IF;
    IF v_unit.costume_id <> v_item.costume_id THEN
      RAISE EXCEPTION 'Unit % does not belong to the booked costume', v_unit.unit_code;
    END IF;
    IF v_unit.size <> v_item.size THEN
      RAISE EXCEPTION 'Unit % is size "%", but the line requests size "%"', v_unit.unit_code, v_unit.size, v_item.size;
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

GRANT EXECUTE ON FUNCTION public.rental_costume_available_units(uuid,date,date,uuid,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.submit_rental_for_approval(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.checkout_rental_order(uuid,jsonb) TO authenticated;
