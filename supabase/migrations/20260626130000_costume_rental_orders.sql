-- Costume Rental — Phase B: rental orders, availability engine, approval.
--
-- A rental order books costume styles for a date range. The same physical unit
-- is re-bookable for non-overlapping dates, so availability is time-based.
-- Over-booking is prevented authoritatively at SUBMIT (the commitment point)
-- under a per-costume row lock; the frontend also checks availability live.

-- ─────────────────────────────────────────────────────────────────────────────
-- Tables
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.rental_orders (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rental_number     text NOT NULL UNIQUE,
  customer_id       uuid REFERENCES public.customers(id) ON DELETE SET NULL,
  status            text NOT NULL DEFAULT 'draft'
                    CHECK (status IN ('draft','pending_approval','approved','rejected',
                                      'checked_out','returned','completed','cancelled')),
  booking_date      date NOT NULL DEFAULT CURRENT_DATE,
  pickup_date       date NOT NULL,
  due_date          date NOT NULL,
  actual_return_date date,
  rental_total      numeric(15,2) NOT NULL DEFAULT 0,
  deposit_total     numeric(15,2) NOT NULL DEFAULT 0,
  discount_amount   numeric(15,2) NOT NULL DEFAULT 0,
  tax_amount        numeric(15,2) NOT NULL DEFAULT 0,
  late_fee          numeric(15,2) NOT NULL DEFAULT 0,
  damage_fee        numeric(15,2) NOT NULL DEFAULT 0,
  deposit_refund    numeric(15,2) NOT NULL DEFAULT 0,
  total_amount      numeric(15,2) NOT NULL DEFAULT 0,
  pending_approval  boolean NOT NULL DEFAULT false,
  approved_by       uuid,
  approved_date     timestamptz,
  approval_comments text,
  checked_out_by    uuid,
  checked_out_at    timestamptz,
  returned_by       uuid,
  returned_at       timestamptz,
  notes             text,
  company_id        uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  created_by        uuid,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT rental_orders_dates CHECK (due_date >= pickup_date)
);
CREATE INDEX IF NOT EXISTS idx_rental_orders_company  ON public.rental_orders(company_id);
CREATE INDEX IF NOT EXISTS idx_rental_orders_customer ON public.rental_orders(customer_id);
CREATE INDEX IF NOT EXISTS idx_rental_orders_status   ON public.rental_orders(status);

CREATE TABLE IF NOT EXISTS public.rental_order_items (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rental_order_id  uuid NOT NULL REFERENCES public.rental_orders(id) ON DELETE CASCADE,
  costume_id       uuid NOT NULL REFERENCES public.rental_costumes(id) ON DELETE RESTRICT,
  quantity         integer NOT NULL DEFAULT 1 CHECK (quantity > 0),
  daily_rate       numeric(15,2) NOT NULL DEFAULT 0,
  rental_days      integer NOT NULL DEFAULT 1 CHECK (rental_days > 0),
  line_total       numeric(15,2) NOT NULL DEFAULT 0,
  security_deposit numeric(15,2) NOT NULL DEFAULT 0,
  company_id       uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_rental_items_order   ON public.rental_order_items(rental_order_id);
CREATE INDEX IF NOT EXISTS idx_rental_items_costume ON public.rental_order_items(costume_id);

-- updated_at triggers
DROP TRIGGER IF EXISTS trg_rental_orders_updated_at ON public.rental_orders;
CREATE TRIGGER trg_rental_orders_updated_at BEFORE UPDATE ON public.rental_orders
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
DROP TRIGGER IF EXISTS trg_rental_items_updated_at ON public.rental_order_items;
CREATE TRIGGER trg_rental_items_updated_at BEFORE UPDATE ON public.rental_order_items
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ─────────────────────────────────────────────────────────────────────────────
-- Numbering: RO-YYYYMMDD-### (per day)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.generate_rental_number()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  next_number integer;
BEGIN
  SELECT COALESCE(MAX(CAST(SUBSTRING(rental_number FROM 'RO-' || TO_CHAR(CURRENT_DATE,'YYYYMMDD') || '-(.*)') AS integer)), 0) + 1
    INTO next_number
    FROM public.rental_orders
   WHERE rental_number LIKE 'RO-' || TO_CHAR(CURRENT_DATE,'YYYYMMDD') || '-%';
  RETURN 'RO-' || TO_CHAR(CURRENT_DATE,'YYYYMMDD') || '-' || LPAD(next_number::text, 3, '0');
END;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- Availability: free units of a style over [p_from, p_to].
-- Committed = orders in pending_approval/approved/checked_out that overlap.
-- ─────────────────────────────────────────────────────────────────────────────
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
   WHERE costume_id = p_costume_id AND status <> 'retired';

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

-- ─────────────────────────────────────────────────────────────────────────────
-- Order totals recompute (mirror update_cpo_total_amount)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.recompute_rental_order_totals()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_order uuid := COALESCE(NEW.rental_order_id, OLD.rental_order_id);
  v_rental numeric(15,2);
  v_deposit numeric(15,2);
BEGIN
  SELECT COALESCE(SUM(line_total),0), COALESCE(SUM(security_deposit),0)
    INTO v_rental, v_deposit
    FROM public.rental_order_items WHERE rental_order_id = v_order;

  UPDATE public.rental_orders
     SET rental_total  = v_rental,
         deposit_total = v_deposit,
         total_amount  = v_rental + tax_amount - discount_amount,
         updated_at    = now()
   WHERE id = v_order;

  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_rental_order_totals ON public.rental_order_items;
CREATE TRIGGER trg_rental_order_totals
  AFTER INSERT OR UPDATE OR DELETE ON public.rental_order_items
  FOR EACH ROW EXECUTE FUNCTION public.recompute_rental_order_totals();

-- ─────────────────────────────────────────────────────────────────────────────
-- Lifecycle RPCs
-- ─────────────────────────────────────────────────────────────────────────────
-- Submit: authoritative over-booking check under per-costume row lock.
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
  v_name  text;
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
    SELECT oi.costume_id, oi.quantity, rc.name
      FROM public.rental_order_items oi
      JOIN public.rental_costumes rc ON rc.id = oi.costume_id
     WHERE oi.rental_order_id = p_id
  LOOP
    -- Lock the style so concurrent submits for the same costume serialise.
    PERFORM 1 FROM public.rental_costumes WHERE id = v_item.costume_id FOR UPDATE;
    v_avail := public.rental_costume_available_units(
                 v_item.costume_id, v_order.pickup_date, v_order.due_date, p_id);
    IF v_item.quantity > v_avail THEN
      RAISE EXCEPTION 'Not enough units of "%" for % to %: requested %, available %',
        v_item.name, v_order.pickup_date, v_order.due_date, v_item.quantity, v_avail;
    END IF;
  END LOOP;

  UPDATE public.rental_orders
     SET status = 'pending_approval', pending_approval = true, updated_at = now()
   WHERE id = p_id
  RETURNING * INTO v_order;
  RETURN v_order;
END;
$$;

CREATE OR REPLACE FUNCTION public.approve_rental_order(p_id uuid, p_comments text DEFAULT NULL)
RETURNS public.rental_orders
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE v_order public.rental_orders; v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Authentication required'; END IF;
  IF NOT public.is_admin(v_uid) THEN RAISE EXCEPTION 'Only admins can approve rental orders'; END IF;
  SELECT * INTO v_order FROM public.rental_orders WHERE id = p_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Rental order % not found', p_id; END IF;
  IF v_order.status <> 'pending_approval' THEN
    RAISE EXCEPTION 'Rental % is not pending approval (status: %)', v_order.rental_number, v_order.status;
  END IF;
  UPDATE public.rental_orders
     SET status='approved', pending_approval=false, approved_by=v_uid,
         approved_date=now(), approval_comments=p_comments, updated_at=now()
   WHERE id = p_id RETURNING * INTO v_order;
  RETURN v_order;
END;
$$;

CREATE OR REPLACE FUNCTION public.reject_rental_order(p_id uuid, p_reason text DEFAULT NULL)
RETURNS public.rental_orders
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE v_order public.rental_orders; v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Authentication required'; END IF;
  IF NOT public.is_admin(v_uid) THEN RAISE EXCEPTION 'Only admins can reject rental orders'; END IF;
  SELECT * INTO v_order FROM public.rental_orders WHERE id = p_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Rental order % not found', p_id; END IF;
  IF v_order.status <> 'pending_approval' THEN
    RAISE EXCEPTION 'Rental % is not pending approval (status: %)', v_order.rental_number, v_order.status;
  END IF;
  UPDATE public.rental_orders
     SET status='rejected', pending_approval=false, approved_by=v_uid,
         approved_date=now(), approval_comments=p_reason, updated_at=now()
   WHERE id = p_id RETURNING * INTO v_order;
  RETURN v_order;
END;
$$;

CREATE OR REPLACE FUNCTION public.cancel_rental_order(p_id uuid, p_reason text DEFAULT NULL)
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
  IF v_order.status NOT IN ('draft','pending_approval','approved','rejected') THEN
    RAISE EXCEPTION 'Rental % cannot be cancelled (status: %)', v_order.rental_number, v_order.status;
  END IF;
  UPDATE public.rental_orders
     SET status='cancelled', pending_approval=false,
         approval_comments = COALESCE(p_reason, approval_comments), updated_at=now()
   WHERE id = p_id RETURNING * INTO v_order;
  RETURN v_order;
END;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- RLS
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.rental_orders      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rental_order_items ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['rental_orders','rental_order_items']
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
                      USING (public.can_access_company(company_id))$p$, t, t);
  END LOOP;
END$$;

GRANT EXECUTE ON FUNCTION public.generate_rental_number() TO authenticated;
GRANT EXECUTE ON FUNCTION public.rental_costume_available_units(uuid,date,date,uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.submit_rental_for_approval(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.approve_rental_order(uuid,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.reject_rental_order(uuid,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.cancel_rental_order(uuid,text) TO authenticated;
