-- Order to delivery: production output, delivery and the customer PO follow
-- the work.
--
-- 1. Production output. When a production order is completed its good output
--    (the last stage's output) becomes a production receipt for the finished
--    good, waiting for the usual admin approval that adds the stock. The
--    finished good comes from the customer PO line, the order's BOM, or its
--    style number; when none fits, the order screen asks which finished good to
--    post to. Receipts keep their production order and company.
-- 2. Delivery. An approved delivery order is dispatched (quantities dispatched
--    on the sales order lines) and then confirmed as delivered with who received
--    it; the sales order becomes delivered once every line has arrived.
--    Approving now moves the sales order to dispatched for whoever approves (the
--    old trigger ran with the approver's own rights and often changed nothing),
--    and cancelling an approved delivery order puts the sales order back.
-- 3. The customer PO moves on by itself: in production once work starts on it,
--    delivered once every line has been delivered; "completed" closes it.
--    Its lines are readable by everyone in the company, not only its author.
-- 4. Picking counted each confirmed pick twice on the sales order line; the
--    extra addition is removed and existing lines are recounted.
--
-- Safe to run more than once.

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. Production output → production receipt
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.finished_goods_batches
  ADD COLUMN IF NOT EXISTS production_order_id uuid REFERENCES public.production_orders(id) ON DELETE SET NULL;
CREATE UNIQUE INDEX IF NOT EXISTS finished_goods_batches_one_per_production_order
  ON public.finished_goods_batches(production_order_id)
  WHERE production_order_id IS NOT NULL AND approval_status IS DISTINCT FROM 'rejected';

ALTER TABLE public.production_orders
  ADD COLUMN IF NOT EXISTS finished_good_id uuid REFERENCES public.finished_goods(id) ON DELETE SET NULL;

-- Good output: what the last stage produced.
CREATE OR REPLACE FUNCTION public.production_order_output(p_order_id uuid)
RETURNS numeric
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT COALESCE((SELECT s.output_qty FROM public.production_order_stages s
                    WHERE s.order_id = p_order_id
                    ORDER BY s.sequence_order DESC LIMIT 1), 0)
$$;

-- The finished good an order produces, when it can be told unambiguously.
CREATE OR REPLACE FUNCTION public.production_order_finished_good(p_order_id uuid)
RETURNS uuid
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  WITH o AS (SELECT * FROM public.production_orders WHERE id = p_order_id),
  c AS (
    SELECT o.finished_good_id AS fg, 0 AS pri FROM o
    UNION ALL
    SELECT ci.finished_good_id, 1 FROM o JOIN public.customer_po_items ci ON ci.id = o.cpo_item_id
    UNION ALL
    SELECT CASE WHEN count(*) = 1 THEN (array_agg(fg.id))[1] END, 2
      FROM o JOIN public.finished_goods fg ON fg.bom_id = o.bom_id
    UNION ALL
    SELECT CASE WHEN count(*) = 1 THEN (array_agg(b.finished_good_id))[1] END, 3
      FROM o JOIN public.bom_finished_goods b ON b.bom_id = o.bom_id
    UNION ALL
    SELECT CASE WHEN count(*) = 1 THEN (array_agg(fg.id))[1] END, 4
      FROM o JOIN public.finished_goods fg
        ON o.style_no IS NOT NULL AND fg.style_no = o.style_no AND fg.company_id IS NOT DISTINCT FROM o.company_id
  )
  SELECT fg FROM c WHERE fg IS NOT NULL ORDER BY pri LIMIT 1
$$;

-- Creates the production receipt for a completed order (pending approval).
-- p_finished_good_id is needed only when the order's finished good can't be told.
CREATE OR REPLACE FUNCTION public.post_production_output(p_order_id uuid, p_finished_good_id uuid DEFAULT NULL)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  o public.production_orders%ROWTYPE;
  v_fg uuid;
  v_qty numeric;
  v_batch uuid;
  v_n integer := 0;
  v_number text;
BEGIN
  SELECT * INTO o FROM public.production_orders WHERE id = p_order_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Production order not found' USING ERRCODE = 'P0002'; END IF;
  IF auth.uid() IS NOT NULL AND NOT public.can_access_company(o.company_id) THEN
    RAISE EXCEPTION 'Not allowed' USING ERRCODE = '42501';
  END IF;
  IF o.status <> 'completed' THEN RAISE EXCEPTION 'Only a completed production order has output to post'; END IF;
  IF EXISTS (SELECT 1 FROM public.finished_goods_batches
              WHERE production_order_id = o.id AND approval_status IS DISTINCT FROM 'rejected') THEN
    RAISE EXCEPTION 'This order''s output is already posted';
  END IF;

  v_fg := COALESCE(p_finished_good_id, public.production_order_finished_good(o.id));
  IF v_fg IS NULL THEN
    RAISE EXCEPTION 'Choose the finished good this order produced';
  END IF;
  IF p_finished_good_id IS NOT NULL AND NOT EXISTS (
       SELECT 1 FROM public.finished_goods WHERE id = p_finished_good_id AND company_id IS NOT DISTINCT FROM o.company_id) THEN
    RAISE EXCEPTION 'That finished good belongs to another company';
  END IF;
  v_qty := public.production_order_output(o.id);
  IF v_qty <= 0 THEN RAISE EXCEPTION 'The last stage recorded no output'; END IF;

  -- One receipt per order; a rejected one can be re-posted with a new number.
  LOOP
    v_number := o.order_number || CASE WHEN v_n = 0 THEN '' ELSE '-' || v_n END;
    EXIT WHEN NOT EXISTS (SELECT 1 FROM public.finished_goods_batches
                           WHERE batch_number = v_number AND company_id IS NOT DISTINCT FROM o.company_id);
    v_n := v_n + 1;
  END LOOP;

  INSERT INTO public.finished_goods_batches (batch_number, finished_good_id, quantity, production_date, notes,
                                             company_id, created_by, approval_status, production_order_id)
  VALUES (v_number, v_fg, v_qty, COALESCE(o.completed_date::date, CURRENT_DATE),
          format('Output of production order %s (%s)', o.order_number, o.product_name),
          o.company_id, COALESCE(auth.uid(), o.created_by), 'pending', o.id)
  RETURNING id INTO v_batch;

  UPDATE public.production_orders SET finished_good_id = v_fg WHERE id = o.id AND finished_good_id IS DISTINCT FROM v_fg;
  RETURN v_batch;
END;
$$;

-- Completing an order posts its output when the finished good is clear.
CREATE OR REPLACE FUNCTION public.auto_post_production_output()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'completed' AND OLD.status IS DISTINCT FROM 'completed'
     AND public.production_order_finished_good(NEW.id) IS NOT NULL
     AND public.production_order_output(NEW.id) > 0
     AND NOT EXISTS (SELECT 1 FROM public.finished_goods_batches
                      WHERE production_order_id = NEW.id AND approval_status IS DISTINCT FROM 'rejected') THEN
    PERFORM public.post_production_output(NEW.id, NULL);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_auto_post_production_output ON public.production_orders;
CREATE TRIGGER trg_auto_post_production_output
  AFTER UPDATE OF status ON public.production_orders
  FOR EACH ROW EXECUTE FUNCTION public.auto_post_production_output();

-- Hand-entered receipts get the company of their finished good when left out.
CREATE OR REPLACE FUNCTION public.default_batch_company()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NEW.company_id IS NULL THEN
    SELECT company_id INTO NEW.company_id FROM public.finished_goods WHERE id = NEW.finished_good_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_default_batch_company ON public.finished_goods_batches;
CREATE TRIGGER trg_default_batch_company
  BEFORE INSERT ON public.finished_goods_batches
  FOR EACH ROW EXECUTE FUNCTION public.default_batch_company();

UPDATE public.finished_goods_batches b
   SET company_id = fg.company_id
  FROM public.finished_goods fg
 WHERE fg.id = b.finished_good_id AND b.company_id IS NULL AND fg.company_id IS NOT NULL;

-- What the production order screen shows about its output.
CREATE OR REPLACE FUNCTION public.production_output_status(p_order_id uuid)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  o public.production_orders%ROWTYPE;
  v_fg uuid;
BEGIN
  SELECT * INTO o FROM public.production_orders WHERE id = p_order_id;
  IF NOT FOUND OR NOT public.can_access_company(o.company_id) THEN
    RAISE EXCEPTION 'Production order not found' USING ERRCODE = 'P0002';
  END IF;
  v_fg := public.production_order_finished_good(o.id);
  RETURN jsonb_build_object(
    'output', public.production_order_output(o.id),
    'finished_good', (SELECT jsonb_build_object('id', fg.id, 'name', fg.product_name, 'code', fg.product_code)
                        FROM public.finished_goods fg WHERE fg.id = v_fg),
    'receipt', (SELECT jsonb_build_object('id', b.id, 'batch_number', b.batch_number, 'quantity', b.quantity,
                                          'approval_status', b.approval_status)
                  FROM public.finished_goods_batches b
                 WHERE b.production_order_id = o.id
                 ORDER BY b.created_at DESC LIMIT 1)
  );
END;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. Delivery
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.delivery_orders
  ADD COLUMN IF NOT EXISTS dispatched_at timestamptz,
  ADD COLUMN IF NOT EXISTS dispatched_by uuid,
  ADD COLUMN IF NOT EXISTS delivered_at timestamptz,
  ADD COLUMN IF NOT EXISTS delivery_confirmed_by uuid,
  ADD COLUMN IF NOT EXISTS received_by_name text,
  ADD COLUMN IF NOT EXISTS delivery_remarks text;

ALTER TABLE public.sales_order_items
  ADD COLUMN IF NOT EXISTS quantity_delivered numeric NOT NULL DEFAULT 0;

CREATE OR REPLACE FUNCTION public.delivery_order_company(p_do public.delivery_orders)
RETURNS uuid
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT COALESCE(p_do.company_id, (SELECT company_id FROM public.sales_orders WHERE id = p_do.sales_order_id)) $$;

-- Approving moves the sales order to dispatched; cancelling an approved delivery
-- order (with no other one under way) puts it back and undoes dispatched
-- quantities. SECURITY DEFINER so it works whoever approves.
CREATE OR REPLACE FUNCTION public.update_so_on_do_creation()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'approved' AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM 'approved') THEN
    UPDATE public.sales_orders SET status = 'dispatched', updated_at = now()
     WHERE id = NEW.sales_order_id AND status NOT IN ('delivered', 'cancelled');
  ELSIF TG_OP = 'UPDATE' AND NEW.status = 'cancelled'
        AND OLD.status IN ('approved', 'ready_for_dispatch', 'dispatched', 'in_transit') THEN
    IF OLD.dispatched_at IS NOT NULL THEN
      UPDATE public.sales_order_items soi
         SET quantity_dispatched = GREATEST(COALESCE(soi.quantity_dispatched, 0) - x.q, 0), updated_at = now()
        FROM (SELECT sales_order_item_id, SUM(quantity_to_deliver) q FROM public.delivery_order_items
               WHERE do_id = NEW.id AND sales_order_item_id IS NOT NULL GROUP BY 1) x
       WHERE soi.id = x.sales_order_item_id;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM public.delivery_orders d
                    WHERE d.sales_order_id = NEW.sales_order_id AND d.id <> NEW.id
                      AND d.status IN ('approved', 'ready_for_dispatch', 'dispatched', 'in_transit', 'delivered')) THEN
      UPDATE public.sales_orders SET status = 'packed', updated_at = now()
       WHERE id = NEW.sales_order_id AND status = 'dispatched';
      PERFORM public.refresh_sales_order_progress(NEW.sales_order_id);
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

-- Dispatching and delivering go through the functions below.
CREATE OR REPLACE FUNCTION public.guard_delivery_order_status()
RETURNS trigger
LANGUAGE plpgsql SET search_path = public
AS $$
BEGIN
  IF current_user NOT IN ('authenticated', 'anon') OR NEW.status IS NOT DISTINCT FROM OLD.status THEN
    RETURN NEW;
  END IF;
  IF OLD.status IN ('delivered', 'cancelled') THEN
    RAISE EXCEPTION 'This delivery order is %, so its status can''t change', OLD.status;
  END IF;
  IF NEW.status IN ('ready_for_dispatch', 'dispatched', 'in_transit', 'delivered', 'failed') THEN
    RAISE EXCEPTION 'Use Dispatch or Confirm delivery on the delivery order' USING ERRCODE = '42501';
  END IF;
  IF NEW.status = 'approved' AND OLD.status NOT IN ('draft', 'pending_approval') THEN
    RAISE EXCEPTION 'Only a draft delivery order can be approved';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_delivery_order_status ON public.delivery_orders;
CREATE TRIGGER trg_guard_delivery_order_status
  BEFORE UPDATE OF status ON public.delivery_orders
  FOR EACH ROW EXECUTE FUNCTION public.guard_delivery_order_status();

CREATE OR REPLACE FUNCTION public.mark_do_dispatched(p_do public.delivery_orders)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  UPDATE public.sales_order_items soi
     SET quantity_dispatched = COALESCE(soi.quantity_dispatched, 0) + x.q, updated_at = now()
    FROM (SELECT sales_order_item_id, SUM(quantity_to_deliver) q FROM public.delivery_order_items
           WHERE do_id = p_do.id AND sales_order_item_id IS NOT NULL GROUP BY 1) x
   WHERE soi.id = x.sales_order_item_id;
  UPDATE public.delivery_orders
     SET status = 'in_transit', dispatched_at = now(), dispatched_by = auth.uid(), updated_at = now()
   WHERE id = p_do.id;
END;
$$;

CREATE OR REPLACE FUNCTION public.dispatch_delivery_order(p_do_id uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  d public.delivery_orders%ROWTYPE;
BEGIN
  SELECT * INTO d FROM public.delivery_orders WHERE id = p_do_id FOR UPDATE;
  IF NOT FOUND OR NOT public.can_work_fulfilment(public.delivery_order_company(d)) THEN
    RAISE EXCEPTION 'You can''t dispatch this delivery order' USING ERRCODE = '42501';
  END IF;
  IF d.status NOT IN ('approved', 'ready_for_dispatch') THEN
    RAISE EXCEPTION 'Only an approved delivery order can be dispatched (this one is %)', replace(d.status, '_', ' ');
  END IF;
  PERFORM public.mark_do_dispatched(d);
END;
$$;

-- p_lines (optional): [{item_id, quantity_delivered}]; lines left out arrived in full.
CREATE OR REPLACE FUNCTION public.confirm_delivery(
  p_do_id uuid,
  p_received_by text,
  p_delivered_at timestamptz DEFAULT now(),
  p_lines jsonb DEFAULT NULL,
  p_remarks text DEFAULT NULL
)
RETURNS text
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  d public.delivery_orders%ROWTYPE;
  it record;
  v_q numeric;
  v_so public.sales_orders%ROWTYPE;
BEGIN
  SELECT * INTO d FROM public.delivery_orders WHERE id = p_do_id FOR UPDATE;
  IF NOT FOUND OR NOT public.can_work_fulfilment(public.delivery_order_company(d)) THEN
    RAISE EXCEPTION 'You can''t confirm this delivery' USING ERRCODE = '42501';
  END IF;
  IF d.status NOT IN ('approved', 'ready_for_dispatch', 'dispatched', 'in_transit') THEN
    RAISE EXCEPTION 'This delivery order is %, so its delivery can''t be confirmed', replace(d.status, '_', ' ');
  END IF;
  IF NULLIF(btrim(COALESCE(p_received_by, '')), '') IS NULL THEN
    RAISE EXCEPTION 'Enter who received the goods';
  END IF;
  IF p_delivered_at IS NULL OR p_delivered_at > now() + interval '10 minutes' THEN
    RAISE EXCEPTION 'The delivery time can''t be in the future';
  END IF;

  IF d.dispatched_at IS NULL THEN
    PERFORM public.mark_do_dispatched(d);
  END IF;

  FOR it IN SELECT * FROM public.delivery_order_items WHERE do_id = d.id FOR UPDATE LOOP
    v_q := COALESCE((SELECT NULLIF(l->>'quantity_delivered', '')::numeric
                       FROM jsonb_array_elements(COALESCE(p_lines, '[]'::jsonb)) l
                      WHERE l->>'item_id' = it.id::text LIMIT 1), it.quantity_to_deliver);
    IF v_q < 0 OR v_q > it.quantity_to_deliver THEN
      RAISE EXCEPTION 'Delivered quantity must be between 0 and %', it.quantity_to_deliver;
    END IF;
    UPDATE public.delivery_order_items SET quantity_delivered = v_q, updated_at = now() WHERE id = it.id;
    IF it.sales_order_item_id IS NOT NULL THEN
      UPDATE public.sales_order_items
         SET quantity_delivered = COALESCE(quantity_delivered, 0) + v_q, updated_at = now()
       WHERE id = it.sales_order_item_id;
    END IF;
  END LOOP;

  UPDATE public.delivery_orders
     SET status = 'delivered', delivered_at = p_delivered_at, delivery_confirmed_by = auth.uid(),
         received_by_name = btrim(p_received_by), delivery_remarks = NULLIF(btrim(COALESCE(p_remarks, '')), ''),
         updated_at = now()
   WHERE id = d.id;

  -- The sales order is delivered once every line has arrived in full.
  SELECT * INTO v_so FROM public.sales_orders WHERE id = d.sales_order_id FOR UPDATE;
  IF FOUND AND v_so.status NOT IN ('delivered', 'cancelled')
     AND NOT EXISTS (SELECT 1 FROM public.sales_order_items
                      WHERE sales_order_id = v_so.id AND quantity_ordered > 0
                        AND COALESCE(quantity_delivered, 0) < quantity_ordered) THEN
    UPDATE public.sales_orders SET status = 'delivered', updated_at = now() WHERE id = v_so.id;
  END IF;
  IF v_so.cpo_id IS NOT NULL THEN
    PERFORM public.refresh_customer_po_progress(v_so.cpo_id);
  END IF;
  RETURN 'delivered';
END;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. Customer PO follows the work
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.refresh_customer_po_progress(p_cpo_id uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  c public.customer_purchase_orders%ROWTYPE;
  v_lines integer;
  v_done integer;
  v_started boolean;
  v_new text;
  v_rank_old integer;
  v_rank_new integer;
BEGIN
  SELECT * INTO c FROM public.customer_purchase_orders WHERE id = p_cpo_id FOR UPDATE;
  IF NOT FOUND OR c.status NOT IN ('confirmed', 'in_production', 'delivered') THEN RETURN; END IF;

  -- Per line: ordered, delivered (through sales orders) and whether production started.
  WITH lines AS (
    SELECT ci.id, ci.quantity_ordered AS ordered,
           COALESCE((SELECT SUM(soi.quantity_delivered) FROM public.sales_order_items soi WHERE soi.cpo_item_id = ci.id), 0) AS delivered,
           EXISTS (SELECT 1 FROM public.production_orders po
                    WHERE po.cpo_item_id = ci.id AND po.status IN ('in_progress', 'completed')) AS producing
      FROM public.customer_po_items ci
     WHERE ci.cpo_id = c.id
  )
  UPDATE public.customer_po_items ci
     SET status = x.s, updated_at = now()
    FROM (SELECT id, CASE WHEN ordered > 0 AND delivered >= ordered THEN 'delivered'
                          WHEN producing OR delivered > 0 THEN 'in_production' END AS s
            FROM lines) x
   WHERE ci.id = x.id AND x.s IS NOT NULL AND ci.status IS DISTINCT FROM x.s
     AND ci.status IS DISTINCT FROM 'delivered';

  WITH lines AS (
    SELECT ci.quantity_ordered AS ordered,
           COALESCE((SELECT SUM(soi.quantity_delivered) FROM public.sales_order_items soi WHERE soi.cpo_item_id = ci.id), 0) AS delivered,
           EXISTS (SELECT 1 FROM public.production_orders po
                    WHERE po.cpo_item_id = ci.id AND po.status IN ('in_progress', 'completed')) AS producing
      FROM public.customer_po_items ci
     WHERE ci.cpo_id = c.id
  )
  SELECT count(*) FILTER (WHERE ordered > 0), count(*) FILTER (WHERE ordered > 0 AND delivered >= ordered),
         bool_or(producing OR delivered > 0)
    INTO v_lines, v_done, v_started
    FROM lines;
  v_started := COALESCE(v_started, false)
    OR EXISTS (SELECT 1 FROM public.production_orders WHERE cpo_id = c.id AND status IN ('in_progress', 'completed'))
    OR EXISTS (SELECT 1 FROM public.sales_orders WHERE cpo_id = c.id AND status IN ('dispatched', 'delivered'));

  v_new := CASE WHEN v_lines > 0 AND v_done = v_lines THEN 'delivered'
                WHEN v_started THEN 'in_production'
                ELSE 'confirmed' END;
  v_rank_old := array_position(ARRAY['confirmed', 'in_production', 'delivered'], c.status);
  v_rank_new := array_position(ARRAY['confirmed', 'in_production', 'delivered'], v_new);
  IF v_rank_new > v_rank_old THEN
    UPDATE public.customer_purchase_orders SET status = v_new, updated_at = now() WHERE id = c.id;
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.cpo_progress_from_production()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NEW.cpo_id IS NOT NULL AND (TG_OP = 'INSERT' OR NEW.status IS DISTINCT FROM OLD.status) THEN
    PERFORM public.refresh_customer_po_progress(NEW.cpo_id);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_cpo_progress_from_production ON public.production_orders;
CREATE TRIGGER trg_cpo_progress_from_production
  AFTER INSERT OR UPDATE OF status ON public.production_orders
  FOR EACH ROW EXECUTE FUNCTION public.cpo_progress_from_production();

-- Delivered → completed, closed by an admin or a sales manager.
CREATE OR REPLACE FUNCTION public.complete_customer_po(p_cpo_id uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  c public.customer_purchase_orders%ROWTYPE;
BEGIN
  SELECT * INTO c FROM public.customer_purchase_orders WHERE id = p_cpo_id FOR UPDATE;
  IF NOT FOUND OR NOT public.can_access_company(c.company_id)
     OR NOT (public.is_admin(auth.uid()) OR (public.has_sales_access(auth.uid()) AND public.has_manager_access(auth.uid()))) THEN
    RAISE EXCEPTION 'Only an admin or a sales manager can complete a customer PO' USING ERRCODE = '42501';
  END IF;
  IF c.status <> 'delivered' THEN
    RAISE EXCEPTION 'Only a delivered customer PO can be completed (this one is %)', replace(c.status, '_', ' ');
  END IF;
  UPDATE public.customer_purchase_orders SET status = 'completed', updated_at = now() WHERE id = c.id;
END;
$$;

-- Everyone in the company can read a customer PO's lines (it was only its author).
DROP POLICY IF EXISTS "Company users can view customer PO items" ON public.customer_po_items;
CREATE POLICY "Company users can view customer PO items" ON public.customer_po_items
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.customer_purchase_orders c
                  WHERE c.id = customer_po_items.cpo_id AND public.can_access_company(c.company_id)));

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. Picking counted once
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.confirm_pick_list(p_pick_list_id uuid, p_lines jsonb)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_pl public.pick_lists%ROWTYPE;
  it record;
  v_line jsonb;
  v_qty numeric;
  v_open numeric;
  v_status text;
BEGIN
  SELECT * INTO v_pl FROM public.pick_lists WHERE id = p_pick_list_id FOR UPDATE;
  IF NOT FOUND OR NOT public.can_work_fulfilment(COALESCE(v_pl.company_id, (SELECT company_id FROM public.sales_orders WHERE id = v_pl.sales_order_id))) THEN
    RAISE EXCEPTION 'You can''t work this pick list' USING ERRCODE = '42501';
  END IF;
  IF v_pl.status NOT IN ('pending', 'assigned', 'in_progress') THEN
    RAISE EXCEPTION 'This pick list is already %', replace(v_pl.status, '_', ' ');
  END IF;

  FOR it IN SELECT * FROM public.pick_list_items WHERE pick_list_id = p_pick_list_id ORDER BY pick_sequence, created_at FOR UPDATE LOOP
    SELECT l INTO v_line FROM jsonb_array_elements(p_lines) l WHERE l->>'pick_list_item_id' = it.id::text LIMIT 1;
    IF v_line IS NULL THEN RAISE EXCEPTION 'Enter the quantity picked for every line'; END IF;
    v_qty := COALESCE(NULLIF(v_line->>'quantity_picked', '')::numeric, 0);
    IF v_qty < 0 OR v_qty > it.quantity_to_pick THEN
      RAISE EXCEPTION 'Picked quantity must be between 0 and %', it.quantity_to_pick;
    END IF;
    SELECT quantity_issued - COALESCE(quantity_picked, 0) INTO v_open FROM public.sales_order_items WHERE id = it.sales_order_item_id FOR UPDATE;
    IF v_qty > COALESCE(v_open, 0) THEN
      RAISE EXCEPTION 'Only % is left to pick on that order line', greatest(v_open, 0);
    END IF;
    v_status := CASE
      WHEN v_qty >= it.quantity_to_pick THEN 'picked'
      WHEN v_qty = 0 AND COALESCE((v_line->>'not_found')::boolean, false) THEN 'not_found'
      ELSE 'short_pick' END;
    UPDATE public.pick_list_items
       SET quantity_picked = v_qty, status = v_status, picked_at = now(), picked_by = v_uid,
           notes = COALESCE(NULLIF(btrim(v_line->>'notes'), ''), notes), updated_at = now()
     WHERE id = it.id;
    -- The order line's picked quantity is added by trigger_update_so_item_on_pick.
  END LOOP;

  UPDATE public.pick_lists
     SET status = 'completed', completed_at = now(), started_at = COALESCE(started_at, now()),
         picker_id = COALESCE(picker_id, v_uid),
         picked_items = (SELECT count(*) FROM public.pick_list_items WHERE pick_list_id = p_pick_list_id AND status = 'picked'),
         updated_at = now()
   WHERE id = p_pick_list_id;
  PERFORM public.refresh_sales_order_progress(v_pl.sales_order_id);
END;
$$;

-- Recount order lines from their pick lines.
UPDATE public.sales_order_items soi
   SET quantity_picked = x.q, updated_at = now()
  FROM (SELECT sales_order_item_id, SUM(COALESCE(quantity_picked, 0)) q
          FROM public.pick_list_items WHERE sales_order_item_id IS NOT NULL GROUP BY 1) x
 WHERE soi.id = x.sales_order_item_id AND soi.quantity_picked IS DISTINCT FROM x.q;

DO $$
DECLARE
  r record;
BEGIN
  FOR r IN SELECT id FROM public.sales_orders WHERE status IN ('picking', 'picked', 'packing', 'packed') LOOP
    PERFORM public.refresh_sales_order_progress(r.id);
  END LOOP;
  -- Bring customer POs up to date with work already done.
  FOR r IN SELECT id FROM public.customer_purchase_orders WHERE status IN ('confirmed', 'in_production') LOOP
    PERFORM public.refresh_customer_po_progress(r.id);
  END LOOP;
END $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- Grants
-- ─────────────────────────────────────────────────────────────────────────────
DO $$
DECLARE
  f text;
BEGIN
  FOREACH f IN ARRAY ARRAY[
    'public.post_production_output(uuid, uuid)',
    'public.production_output_status(uuid)',
    'public.dispatch_delivery_order(uuid)',
    'public.confirm_delivery(uuid, text, timestamptz, jsonb, text)',
    'public.complete_customer_po(uuid)'
  ] LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon', f);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated', f);
  END LOOP;
  FOREACH f IN ARRAY ARRAY[
    'public.refresh_customer_po_progress(uuid)',
    'public.mark_do_dispatched(public.delivery_orders)',
    'public.production_order_finished_good(uuid)',
    'public.production_order_output(uuid)'
  ] LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon, authenticated', f);
  END LOOP;
END $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- Read-only check after applying:
--   SELECT
--     (SELECT count(*) FROM pg_proc WHERE proname IN ('post_production_output', 'dispatch_delivery_order', 'confirm_delivery',
--        'refresh_customer_po_progress', 'complete_customer_po', 'production_output_status')) AS functions,  -- 6
--     (SELECT count(*) FROM pg_trigger WHERE tgname IN ('trg_auto_post_production_output', 'trg_guard_delivery_order_status',
--        'trg_cpo_progress_from_production', 'trg_default_batch_company')) AS triggers,  -- 4
--     (SELECT count(*) FROM public.customer_purchase_orders WHERE status = 'in_production') AS cpos_in_production,
--     (SELECT count(*) FROM public.production_orders po WHERE po.status = 'completed'
--        AND NOT EXISTS (SELECT 1 FROM public.finished_goods_batches b WHERE b.production_order_id = po.id)) AS completed_orders_without_receipt;
-- ─────────────────────────────────────────────────────────────────────────────
