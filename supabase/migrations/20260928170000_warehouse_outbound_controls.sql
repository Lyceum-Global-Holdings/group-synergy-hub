-- Warehouse: issues, transfers & assets — the three open items.
--
--   1. Stock transfers check and hold stock. Submitting (or approving) a
--      transfer reserves each line's quantity in its source bin, so it can't be
--      promised twice; a line that isn't there is refused. Someone other than
--      the requester approves (admins excepted). Completing moves every line in
--      one database transaction, or nothing. Quick bin-to-bin moves go through
--      the same checks (move_stock_now).
--   2. Damaged and expired returns no longer re-enter usable stock. On approval
--      they go into their bin on hold (a quarantine reservation), and a
--      warehouse manager releases them, scraps them or returns them to the
--      supplier. Cancelled return notes no longer count against what can still
--      be returned.
--   3. Picking and packing work: a pick list is started and confirmed line by
--      line, the sales order moves to picked, then packing records packages and
--      moves it to packed, which opens delivery. "Reset" is limited to super
--      admins and one company.
--
-- Safe to run more than once.

-- ─────────────────────────────────────────────────────────────────────────────
-- 0. Shared
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.warehouse_item_reservations
  DROP CONSTRAINT IF EXISTS warehouse_item_reservations_reference_type_check;
ALTER TABLE public.warehouse_item_reservations
  ADD CONSTRAINT warehouse_item_reservations_reference_type_check
  CHECK (reference_type IN ('cpo', 'material_request', 'production_order', 'sales_order', 'manual',
                            'material_issue', 'stock_transfer', 'quarantine'));

ALTER TABLE public.warehouse_item_reservations
  ADD COLUMN IF NOT EXISTS transfer_item_id uuid REFERENCES public.stock_transfer_items(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS mrn_item_id uuid REFERENCES public.material_return_items(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_item_reservations_transfer_item ON public.warehouse_item_reservations(transfer_item_id);

-- Who approves stock movements and decides on held stock.
CREATE OR REPLACE FUNCTION public.can_approve_stock_moves(p_user uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT p_user IS NOT NULL AND (
    public.is_admin(p_user)
    OR (public.has_warehouse_access(p_user) AND public.has_manager_access(p_user))
  )
$$;

-- Keep a bin's displayed total in step with its allocations.
CREATE OR REPLACE FUNCTION public.refresh_bin_quantity(p_bin_id uuid)
RETURNS void
LANGUAGE sql SECURITY DEFINER SET search_path = public
AS $$
  UPDATE public.warehouse_bins
     SET current_quantity = (SELECT COALESCE(SUM(allocated_quantity), 0) FROM public.warehouse_bin_allocations WHERE bin_id = p_bin_id)
   WHERE id = p_bin_id
$$;

-- Move quantity of an item from one bin to another, with its batches, and log
-- both legs. The caller has already released any reservation it holds on the
-- quantity. Raises when the source bin doesn't have it free.
CREATE OR REPLACE FUNCTION public.move_bin_stock(
  p_item_id uuid, p_from_bin_id uuid, p_to_bin_id uuid, p_quantity numeric,
  p_reference_id uuid, p_reference_number text
)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_src public.warehouse_bin_allocations%ROWTYPE;
  v_dst public.warehouse_bin_allocations%ROWTYPE;
  v_from public.warehouse_bins%ROWTYPE;
  v_to public.warehouse_bins%ROWTYPE;
  v_item text;
  v_free numeric;
  v_left numeric := p_quantity;
  v_take numeric;
  b record;
BEGIN
  IF p_quantity IS NULL OR p_quantity <= 0 THEN RAISE EXCEPTION 'Enter a quantity above zero'; END IF;
  IF p_from_bin_id IS NULL OR p_to_bin_id IS NULL THEN RAISE EXCEPTION 'Choose the source and destination bins'; END IF;
  IF p_from_bin_id = p_to_bin_id THEN RAISE EXCEPTION 'The source and destination bins must be different'; END IF;

  SELECT * INTO v_from FROM public.warehouse_bins WHERE id = p_from_bin_id;
  SELECT * INTO v_to FROM public.warehouse_bins WHERE id = p_to_bin_id;
  SELECT COALESCE(item_code || ' ', '') || name INTO v_item FROM public.warehouse_items_full WHERE id = p_item_id;

  SELECT * INTO v_src FROM public.warehouse_bin_allocations
   WHERE warehouse_item_id = p_item_id AND bin_id = p_from_bin_id FOR UPDATE;
  v_free := COALESCE(v_src.allocated_quantity, 0) - COALESCE(v_src.reserved_quantity, 0);
  IF v_src.id IS NULL OR v_free < p_quantity THEN
    RAISE EXCEPTION 'Only % of % is free in bin % (on hand %, held for other work %)',
      greatest(v_free, 0), v_item, v_from.bin_code, COALESCE(v_src.allocated_quantity, 0), COALESCE(v_src.reserved_quantity, 0)
      USING ERRCODE = 'check_violation';
  END IF;

  UPDATE public.warehouse_bin_allocations
     SET allocated_quantity = allocated_quantity - p_quantity, updated_at = now()
   WHERE id = v_src.id;

  INSERT INTO public.warehouse_bin_allocations (warehouse_item_id, bin_id, allocated_quantity, company_id, created_by)
  VALUES (p_item_id, p_to_bin_id, 0, COALESCE(v_to.company_id, v_src.company_id), auth.uid())
  ON CONFLICT (warehouse_item_id, bin_id) DO NOTHING;
  SELECT * INTO v_dst FROM public.warehouse_bin_allocations
   WHERE warehouse_item_id = p_item_id AND bin_id = p_to_bin_id FOR UPDATE;
  UPDATE public.warehouse_bin_allocations
     SET allocated_quantity = allocated_quantity + p_quantity, updated_at = now()
   WHERE id = v_dst.id;

  -- Batches follow the stock, earliest expiry first.
  FOR b IN
    SELECT bsa.id, bsa.batch_id, bsa.allocated_quantity
      FROM public.batch_stock_allocations bsa
      JOIN public.item_batches ib ON ib.id = bsa.batch_id
     WHERE ib.warehouse_item_id = p_item_id AND bsa.bin_id = p_from_bin_id AND bsa.allocated_quantity > 0
     ORDER BY ib.expiry_date NULLS LAST, ib.manufacturing_date NULLS LAST, ib.created_at
     FOR UPDATE OF bsa
  LOOP
    EXIT WHEN v_left <= 0;
    v_take := LEAST(v_left, b.allocated_quantity);
    UPDATE public.batch_stock_allocations SET allocated_quantity = allocated_quantity - v_take, updated_at = now() WHERE id = b.id;
    INSERT INTO public.batch_stock_allocations (batch_id, bin_id, allocated_quantity, company_id)
    VALUES (b.batch_id, p_to_bin_id, v_take, COALESCE(v_to.company_id, v_src.company_id))
    ON CONFLICT (batch_id, bin_id) DO UPDATE
      SET allocated_quantity = public.batch_stock_allocations.allocated_quantity + EXCLUDED.allocated_quantity, updated_at = now();
    v_left := v_left - v_take;
  END LOOP;

  INSERT INTO public.warehouse_stock_movements (warehouse_item_id, bin_allocation_id, movement_type, reference_type, reference_id,
                                                reference_number, quantity_change, quantity_before, quantity_after, notes, created_by, company_id)
  VALUES
    (p_item_id, v_src.id, 'transfer', 'transfer', p_reference_id, p_reference_number, -p_quantity,
     v_src.allocated_quantity, v_src.allocated_quantity - p_quantity, format('Transfer %s out of bin %s', p_reference_number, v_from.bin_code), auth.uid(), v_src.company_id),
    (p_item_id, v_dst.id, 'transfer', 'transfer', p_reference_id, p_reference_number, p_quantity,
     v_dst.allocated_quantity, v_dst.allocated_quantity + p_quantity, format('Transfer %s into bin %s', p_reference_number, v_to.bin_code), auth.uid(), v_dst.company_id);

  INSERT INTO public.stock_transactions (item_id, location_id, bin_id, transaction_type, reference_type, reference_id,
                                         quantity_change, notes, company_id, created_by)
  VALUES
    (p_item_id, v_from.location_id, p_from_bin_id, 'transfer_out', 'transfer', p_reference_id, -p_quantity,
     format('Transfer %s out of bin %s', p_reference_number, v_from.bin_code), v_src.company_id, auth.uid()),
    (p_item_id, v_to.location_id, p_to_bin_id, 'transfer_in', 'transfer', p_reference_id, p_quantity,
     format('Transfer %s into bin %s', p_reference_number, v_to.bin_code), v_dst.company_id, auth.uid());

  PERFORM public.refresh_bin_quantity(p_from_bin_id);
  PERFORM public.refresh_bin_quantity(p_to_bin_id);
END;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. Stock transfers
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.release_stock_transfer(p_transfer_id uuid)
RETURNS void
LANGUAGE sql SECURITY DEFINER SET search_path = public
AS $$
  UPDATE public.warehouse_item_reservations
     SET status = 'cancelled', updated_at = now()
   WHERE reference_type = 'stock_transfer' AND reference_id = p_transfer_id
     AND status IN ('active', 'partially_issued')
$$;

-- Hold each open line's quantity in its source bin; raises on the first line
-- that isn't free there. Re-running replaces the previous hold. With
-- p_hold = false it only checks (used for drafts).
CREATE OR REPLACE FUNCTION public.reserve_stock_transfer(p_transfer_id uuid, p_hold boolean DEFAULT true)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_t public.stock_transfer_requests%ROWTYPE;
  l record;
  v_alloc public.warehouse_bin_allocations%ROWTYPE;
  v_free numeric;
  v_bin text;
  v_used jsonb := '{}'::jsonb;   -- check-only mode: quantity already claimed by earlier lines, per item and bin
  v_key text;
BEGIN
  SELECT * INTO v_t FROM public.stock_transfer_requests WHERE id = p_transfer_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Transfer not found'; END IF;
  IF auth.uid() IS NOT NULL AND NOT public.can_access_company(v_t.company_id) THEN
    RAISE EXCEPTION 'You can''t change this transfer' USING ERRCODE = '42501';
  END IF;
  IF p_hold THEN PERFORM public.release_stock_transfer(p_transfer_id); END IF;

  IF NOT EXISTS (SELECT 1 FROM public.stock_transfer_items WHERE transfer_id = p_transfer_id AND status <> 'completed') THEN
    RAISE EXCEPTION 'Add at least one item to the transfer';
  END IF;

  FOR l IN
    SELECT * FROM public.stock_transfer_items WHERE transfer_id = p_transfer_id AND status <> 'completed' ORDER BY created_at, id
  LOOP
    IF COALESCE(l.quantity_requested, 0) <= 0 THEN RAISE EXCEPTION 'Enter a quantity above zero for %', l.item_name; END IF;
    IF l.from_bin_id IS NULL OR l.to_bin_id IS NULL THEN RAISE EXCEPTION 'Choose the source and destination bins for %', l.item_name; END IF;
    IF l.from_bin_id = l.to_bin_id THEN RAISE EXCEPTION 'The source and destination bins for % are the same', l.item_name; END IF;

    SELECT * INTO v_alloc FROM public.warehouse_bin_allocations
     WHERE warehouse_item_id = l.warehouse_item_id AND bin_id = l.from_bin_id FOR UPDATE;
    v_key := l.warehouse_item_id::text || '|' || l.from_bin_id::text;
    v_free := COALESCE(v_alloc.allocated_quantity, 0) - COALESCE(v_alloc.reserved_quantity, 0)
              - COALESCE((v_used->>v_key)::numeric, 0);
    IF v_alloc.id IS NULL OR v_free < l.quantity_requested THEN
      SELECT bin_code INTO v_bin FROM public.warehouse_bins WHERE id = l.from_bin_id;
      RAISE EXCEPTION 'Only % of % is free in bin % (on hand %, held for other work %)',
        greatest(v_free, 0), l.item_name, v_bin, COALESCE(v_alloc.allocated_quantity, 0), COALESCE(v_alloc.reserved_quantity, 0)
        USING ERRCODE = 'check_violation';
    END IF;

    IF p_hold THEN
      INSERT INTO public.warehouse_item_reservations (
        warehouse_item_id, bin_allocation_id, reserved_quantity, reference_type, reference_id, reference_number,
        transfer_item_id, status, reserved_by, company_id, required_date, notes)
      VALUES (l.warehouse_item_id, v_alloc.id, l.quantity_requested, 'stock_transfer', p_transfer_id, v_t.transfer_number,
              l.id, 'active', auth.uid(), v_t.company_id, v_t.expected_completion_date, 'Held for stock transfer');
    ELSE
      v_used := jsonb_set(v_used, ARRAY[v_key], to_jsonb(COALESCE((v_used->>v_key)::numeric, 0) + l.quantity_requested));
    END IF;
  END LOOP;
END;
$$;

-- Why the signed-in user can't approve this transfer, or NULL.
CREATE OR REPLACE FUNCTION public.stock_transfer_block_reason(p_transfer_id uuid)
RETURNS text
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_t public.stock_transfer_requests%ROWTYPE;
BEGIN
  SELECT * INTO v_t FROM public.stock_transfer_requests WHERE id = p_transfer_id;
  IF NOT FOUND THEN RETURN 'Transfer not found'; END IF;
  IF v_t.status <> 'pending_approval' THEN RETURN 'This transfer isn''t waiting for approval'; END IF;
  IF NOT public.can_access_company(v_t.company_id) OR NOT public.can_approve_stock_moves(auth.uid()) THEN
    RETURN 'Transfers are approved by a warehouse manager or an admin';
  END IF;
  IF NOT public.is_admin(auth.uid()) AND auth.uid() IN (v_t.requested_by, v_t.created_by) THEN
    RETURN 'You requested this transfer, so someone else must approve it';
  END IF;
  RETURN NULL;
END;
$$;

-- Status changes made directly by the app. Server functions (which run as the
-- function owner) apply their own rules and pass through.
CREATE OR REPLACE FUNCTION public.enforce_stock_transfer_flow()
RETURNS trigger
LANGUAGE plpgsql SET search_path = public
AS $$
DECLARE
  v_reason text;
BEGIN
  IF current_user NOT IN ('authenticated', 'anon') THEN RETURN NEW; END IF;

  IF TG_OP = 'INSERT' THEN
    IF NEW.status NOT IN ('draft', 'pending_approval') THEN
      RAISE EXCEPTION 'Create the transfer as a draft or submit it for approval' USING ERRCODE = '42501';
    END IF;
    RETURN NEW;
  END IF;

  IF NEW.status = OLD.status THEN RETURN NEW; END IF;

  IF NEW.status = 'pending_approval' AND OLD.status = 'draft' THEN
    PERFORM public.reserve_stock_transfer(OLD.id);
    NEW.requested_date := COALESCE(NEW.requested_date, CURRENT_DATE);
  ELSIF NEW.status = 'approved' AND OLD.status = 'pending_approval' THEN
    v_reason := public.stock_transfer_block_reason(OLD.id);
    IF v_reason IS NOT NULL THEN RAISE EXCEPTION '%', v_reason USING ERRCODE = '42501'; END IF;
    NEW.approved_by := auth.uid();
    NEW.approved_date := now();
  ELSIF NEW.status = 'in_transit' AND OLD.status = 'approved' THEN
    NULL;
  ELSIF NEW.status = 'draft' AND OLD.status = 'pending_approval' THEN
    PERFORM public.release_stock_transfer(OLD.id);
  ELSIF NEW.status = 'cancelled' AND OLD.status IN ('draft', 'pending_approval', 'approved', 'in_transit') THEN
    PERFORM public.release_stock_transfer(OLD.id);
  ELSIF NEW.status = 'completed' THEN
    RAISE EXCEPTION 'Use Complete transfer, which moves the stock' USING ERRCODE = '42501';
  ELSE
    RAISE EXCEPTION 'A transfer can''t go from % to %', replace(OLD.status, '_', ' '), replace(NEW.status, '_', ' ');
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_stock_transfer_flow ON public.stock_transfer_requests;
CREATE TRIGGER trg_enforce_stock_transfer_flow
  BEFORE INSERT OR UPDATE OF status ON public.stock_transfer_requests
  FOR EACH ROW EXECUTE FUNCTION public.enforce_stock_transfer_flow();

-- Lines added or changed once a transfer is past draft are re-checked and re-held.
CREATE OR REPLACE FUNCTION public.recheck_stock_transfer_lines()
RETURNS trigger
LANGUAGE plpgsql SET search_path = public
AS $$
DECLARE
  v_status text;
BEGIN
  IF current_user NOT IN ('authenticated', 'anon') THEN RETURN NULL; END IF;
  SELECT status INTO v_status FROM public.stock_transfer_requests WHERE id = COALESCE(NEW.transfer_id, OLD.transfer_id);
  IF v_status IN ('completed', 'cancelled') THEN
    RAISE EXCEPTION 'This transfer is %, so its lines can''t change', v_status USING ERRCODE = '42501';
  END IF;
  IF v_status IN ('pending_approval', 'approved', 'in_transit') THEN
    PERFORM public.reserve_stock_transfer(COALESCE(NEW.transfer_id, OLD.transfer_id));
  END IF;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_recheck_stock_transfer_lines ON public.stock_transfer_items;
CREATE TRIGGER trg_recheck_stock_transfer_lines
  AFTER INSERT OR UPDATE OF quantity_requested, from_bin_id, to_bin_id, warehouse_item_id ON public.stock_transfer_items
  FOR EACH ROW EXECUTE FUNCTION public.recheck_stock_transfer_lines();

-- Create a transfer with its lines in one step. Admins' transfers are approved
-- straight away (as before); others are saved as a draft or submitted.
-- p_header: {transfer_date, transfer_type, priority, expected_completion_date, reason, notes, company_id}
-- p_items:  [{warehouse_item_id, item_code, item_name, quantity_requested, unit_of_measure, from_bin_id, to_bin_id, notes}]
CREATE OR REPLACE FUNCTION public.create_stock_transfer(p_header jsonb, p_items jsonb, p_submit boolean DEFAULT false)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_company uuid := NULLIF(p_header->>'company_id', '')::uuid;
  v_t public.stock_transfer_requests%ROWTYPE;
  v_line jsonb;
  v_status text;
  v_bin record;
BEGIN
  IF v_uid IS NULL OR v_company IS NULL OR NOT public.can_access_company(v_company)
     OR NOT (public.has_warehouse_access(v_uid) OR public.is_admin(v_uid)) THEN
    RAISE EXCEPTION 'You can''t create stock transfers for this company' USING ERRCODE = '42501';
  END IF;
  IF jsonb_typeof(p_items) <> 'array' OR jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'Add at least one item to the transfer';
  END IF;

  -- Both ends must be locations the user may work in.
  FOR v_bin IN
    SELECT DISTINCT wb.id, wb.bin_code, wb.location_id
      FROM jsonb_array_elements(p_items) i
      JOIN public.warehouse_bins wb ON wb.id IN (NULLIF(i->>'from_bin_id', '')::uuid, NULLIF(i->>'to_bin_id', '')::uuid)
  LOOP
    IF NOT public.user_location_allowed(v_uid, v_bin.location_id) THEN
      RAISE EXCEPTION 'You don''t have access to the location of bin %', v_bin.bin_code USING ERRCODE = '42501';
    END IF;
  END LOOP;

  INSERT INTO public.stock_transfer_requests (
    transfer_number, transfer_date, transfer_type, priority, expected_completion_date, reason, notes,
    company_id, status, created_by, requested_by, requested_date)
  VALUES (
    '', COALESCE(NULLIF(p_header->>'transfer_date', '')::date, CURRENT_DATE),
    COALESCE(NULLIF(p_header->>'transfer_type', ''), 'location'), COALESCE(NULLIF(p_header->>'priority', ''), 'normal'),
    NULLIF(p_header->>'expected_completion_date', '')::date, NULLIF(btrim(p_header->>'reason'), ''), NULLIF(btrim(p_header->>'notes'), ''),
    v_company, 'draft', v_uid, v_uid, CURRENT_DATE)
  RETURNING * INTO v_t;

  FOR v_line IN SELECT * FROM jsonb_array_elements(p_items) LOOP
    INSERT INTO public.stock_transfer_items (transfer_id, warehouse_item_id, item_code, item_name, quantity_requested,
                                             unit_of_measure, from_bin_id, to_bin_id, notes)
    SELECT v_t.id, wi.id, COALESCE(NULLIF(v_line->>'item_code', ''), wi.item_code), COALESCE(NULLIF(v_line->>'item_name', ''), wi.name, 'Item'),
           NULLIF(v_line->>'quantity_requested', '')::numeric, COALESCE(NULLIF(v_line->>'unit_of_measure', ''), 'pcs'),
           NULLIF(v_line->>'from_bin_id', '')::uuid, NULLIF(v_line->>'to_bin_id', '')::uuid, NULLIF(btrim(v_line->>'notes'), '')
      FROM public.warehouse_items_full wi WHERE wi.id = NULLIF(v_line->>'warehouse_item_id', '')::uuid;
    IF NOT FOUND THEN RAISE EXCEPTION 'An item on the transfer wasn''t found'; END IF;
  END LOOP;

  v_status := CASE WHEN public.is_admin(v_uid) THEN 'approved' WHEN p_submit THEN 'pending_approval' ELSE 'draft' END;
  -- Checks stock and raises (undoing everything) if short. Drafts are checked
  -- too, so a transfer that can't happen is caught now, but hold nothing yet.
  PERFORM public.reserve_stock_transfer(v_t.id, v_status <> 'draft');
  UPDATE public.stock_transfer_requests
     SET status = v_status,
         approved_by = CASE WHEN v_status = 'approved' THEN v_uid END,
         approved_date = CASE WHEN v_status = 'approved' THEN now() END
   WHERE id = v_t.id;

  RETURN jsonb_build_object('id', v_t.id, 'transfer_number', (SELECT transfer_number FROM public.stock_transfer_requests WHERE id = v_t.id), 'status', v_status);
END;
$$;

-- Complete an approved or in-transit transfer: every line moves, or none does.
CREATE OR REPLACE FUNCTION public.complete_stock_transfer(p_transfer_id uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_t public.stock_transfer_requests%ROWTYPE;
  l record;
  v_loc uuid;
BEGIN
  SELECT * INTO v_t FROM public.stock_transfer_requests WHERE id = p_transfer_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Transfer not found'; END IF;
  IF v_uid IS NULL OR NOT public.can_access_company(v_t.company_id)
     OR NOT (public.has_warehouse_access(v_uid) OR public.is_admin(v_uid)) THEN
    RAISE EXCEPTION 'You can''t complete this transfer' USING ERRCODE = '42501';
  END IF;
  IF v_t.status NOT IN ('approved', 'in_transit') THEN
    RAISE EXCEPTION 'Only approved transfers can be completed (this one is %)', replace(v_t.status, '_', ' ');
  END IF;
  FOR v_loc IN
    SELECT DISTINCT wb.location_id FROM public.stock_transfer_items i
      JOIN public.warehouse_bins wb ON wb.id IN (i.from_bin_id, i.to_bin_id)
     WHERE i.transfer_id = p_transfer_id
  LOOP
    IF NOT public.user_location_allowed(v_uid, v_loc) THEN
      RAISE EXCEPTION 'You don''t have access to one of this transfer''s locations' USING ERRCODE = '42501';
    END IF;
  END LOOP;

  FOR l IN
    SELECT * FROM public.stock_transfer_items WHERE transfer_id = p_transfer_id AND status <> 'completed' ORDER BY created_at, id FOR UPDATE
  LOOP
    -- The held quantity is used by this move.
    UPDATE public.warehouse_item_reservations
       SET status = 'issued', quantity_issued = reserved_quantity, updated_at = now()
     WHERE transfer_item_id = l.id AND status IN ('active', 'partially_issued');
    PERFORM public.move_bin_stock(l.warehouse_item_id, l.from_bin_id, l.to_bin_id, l.quantity_requested, p_transfer_id, v_t.transfer_number);
    UPDATE public.stock_transfer_items
       SET status = 'completed', quantity_transferred = l.quantity_requested, updated_at = now()
     WHERE id = l.id;
  END LOOP;

  UPDATE public.stock_transfer_requests
     SET status = 'completed', completed_by = v_uid, completed_date = now(), updated_at = now()
   WHERE id = p_transfer_id;
END;
$$;

-- A storekeeper's immediate bin-to-bin move, recorded as a completed transfer.
CREATE OR REPLACE FUNCTION public.move_stock_now(
  p_item_id uuid, p_from_bin_id uuid, p_to_bin_id uuid, p_quantity numeric,
  p_reason text DEFAULT NULL, p_notes text DEFAULT NULL, p_transfer_date date DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_item record;
  v_from public.warehouse_bins%ROWTYPE;
  v_to public.warehouse_bins%ROWTYPE;
  v_company uuid;
  v_t public.stock_transfer_requests%ROWTYPE;
BEGIN
  SELECT id, item_code, name, company_id INTO v_item FROM public.warehouse_items_full WHERE id = p_item_id;
  SELECT * INTO v_from FROM public.warehouse_bins WHERE id = p_from_bin_id;
  SELECT * INTO v_to FROM public.warehouse_bins WHERE id = p_to_bin_id;
  IF v_item.id IS NULL OR v_from.id IS NULL OR v_to.id IS NULL THEN RAISE EXCEPTION 'Item or bin not found'; END IF;
  v_company := COALESCE(v_from.company_id, v_item.company_id);
  IF v_uid IS NULL OR NOT public.can_access_company(v_company)
     OR NOT (public.has_warehouse_access(v_uid) OR public.is_admin(v_uid))
     OR NOT public.user_location_allowed(v_uid, v_from.location_id)
     OR NOT public.user_location_allowed(v_uid, v_to.location_id) THEN
    RAISE EXCEPTION 'You can''t move stock between these bins' USING ERRCODE = '42501';
  END IF;

  INSERT INTO public.stock_transfer_requests (transfer_number, transfer_date, transfer_type, priority, reason, notes, company_id,
                                              status, created_by, requested_by, requested_date, approved_by, approved_date)
  VALUES ('', COALESCE(p_transfer_date, CURRENT_DATE), 'location', 'normal', NULLIF(btrim(p_reason), ''), NULLIF(btrim(p_notes), ''),
          v_company, 'approved', v_uid, v_uid, CURRENT_DATE, v_uid, now())
  RETURNING * INTO v_t;
  INSERT INTO public.stock_transfer_items (transfer_id, warehouse_item_id, item_code, item_name, quantity_requested, unit_of_measure,
                                           from_bin_id, to_bin_id, notes, status, quantity_transferred)
  VALUES (v_t.id, p_item_id, v_item.item_code, COALESCE(v_item.name, 'Item'), p_quantity, 'pcs', p_from_bin_id, p_to_bin_id,
          NULLIF(btrim(p_notes), ''), 'completed', p_quantity);

  PERFORM public.move_bin_stock(p_item_id, p_from_bin_id, p_to_bin_id, p_quantity, v_t.id,
                                (SELECT transfer_number FROM public.stock_transfer_requests WHERE id = v_t.id));

  UPDATE public.stock_transfer_requests SET status = 'completed', completed_by = v_uid, completed_date = now() WHERE id = v_t.id;
  RETURN jsonb_build_object('id', v_t.id, 'transfer_number', (SELECT transfer_number FROM public.stock_transfer_requests WHERE id = v_t.id));
END;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. Returns: damaged and expired stock on hold
-- ─────────────────────────────────────────────────────────────────────────────

-- Cancelled return notes no longer count against what can still be returned.
CREATE OR REPLACE FUNCTION public.enforce_material_return_within_issued()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_ref_type text;
  v_ref_id   uuid;
  v_min_id   uuid;
  v_issued   numeric;
  v_returned numeric;
BEGIN
  SELECT reference_type, reference_id
    INTO v_ref_type, v_ref_id
  FROM public.material_return_notes
  WHERE id = NEW.mrn_id;

  IF v_ref_type IS DISTINCT FROM 'material_issue' OR v_ref_id IS NULL THEN
    RETURN NEW;
  END IF;

  v_min_id := v_ref_id;

  SELECT COALESCE(SUM(quantity_issued), 0)
    INTO v_issued
  FROM public.material_issue_items
  WHERE min_id = v_min_id AND item_id = NEW.item_id;

  SELECT COALESCE(SUM(mri.quantity_returned), 0)
    INTO v_returned
  FROM public.material_return_items mri
  JOIN public.material_return_notes mrn ON mrn.id = mri.mrn_id
  WHERE mrn.reference_type = 'material_issue'
    AND mrn.reference_id = v_min_id
    AND mrn.status <> 'cancelled'
    AND mri.item_id = NEW.item_id
    AND (TG_OP = 'INSERT' OR mri.id <> NEW.id);

  IF (v_returned + NEW.quantity_returned) > v_issued THEN
    RAISE EXCEPTION
      'Return quantity (%) exceeds remaining issued qty (%) for item % on this MIN',
      NEW.quantity_returned, GREATEST(v_issued - v_returned, 0), NEW.item_id
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$function$;

-- When a return note is approved, its damaged and expired lines go into their
-- bin on hold, so they can't be issued or transferred until someone decides.
CREATE OR REPLACE FUNCTION public.hold_damaged_returns()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  i record;
  v_alloc uuid;
BEGIN
  IF NEW.status <> 'returned' OR OLD.status = 'returned' THEN RETURN NEW; END IF;
  FOR i IN
    SELECT * FROM public.material_return_items
     WHERE mrn_id = NEW.id AND condition IN ('damaged', 'expired') AND quantity_returned > 0 AND bin_id IS NOT NULL
  LOOP
    IF EXISTS (SELECT 1 FROM public.warehouse_item_reservations WHERE mrn_item_id = i.id AND reference_type = 'quarantine') THEN
      CONTINUE;
    END IF;
    SELECT id INTO v_alloc FROM public.warehouse_bin_allocations WHERE warehouse_item_id = i.item_id AND bin_id = i.bin_id;
    IF v_alloc IS NULL THEN CONTINUE; END IF;
    INSERT INTO public.warehouse_item_reservations (
      warehouse_item_id, bin_allocation_id, reserved_quantity, reference_type, reference_id, reference_number,
      mrn_item_id, status, reserved_by, company_id, notes)
    VALUES (i.item_id, v_alloc, i.quantity_returned, 'quarantine', NEW.id, NEW.mrn_number,
            i.id, 'active', COALESCE(NEW.approved_by, auth.uid()), NEW.company_id,
            initcap(i.condition) || ' return' || COALESCE(': ' || NULLIF(btrim(i.notes), ''), ''));
  END LOOP;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_hold_damaged_returns ON public.material_return_notes;
CREATE TRIGGER trg_hold_damaged_returns
  AFTER UPDATE OF status ON public.material_return_notes
  FOR EACH ROW EXECUTE FUNCTION public.hold_damaged_returns();

-- Held stock for the screen.
CREATE OR REPLACE FUNCTION public.list_quarantine_holds(p_company_id uuid)
RETURNS TABLE (
  hold_id uuid, item_id uuid, item_code text, item_name text, bin_id uuid, bin_code text, location_name text,
  quantity_held numeric, reason text, reference_number text, held_since timestamptz
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT r.id, r.warehouse_item_id, wi.item_code, wi.name, wb.id, wb.bin_code, wl.name,
         r.reserved_quantity - r.quantity_issued, r.notes, r.reference_number, r.created_at
    FROM public.warehouse_item_reservations r
    JOIN public.warehouse_items_full wi ON wi.id = r.warehouse_item_id
    LEFT JOIN public.warehouse_bin_allocations a ON a.id = r.bin_allocation_id
    LEFT JOIN public.warehouse_bins wb ON wb.id = a.bin_id
    LEFT JOIN public.warehouse_locations wl ON wl.id = wb.location_id
   WHERE r.reference_type = 'quarantine' AND r.status IN ('active', 'partially_issued')
     AND r.company_id = p_company_id AND public.can_access_company(p_company_id)
     AND public.user_location_allowed(auth.uid(), wb.location_id)
   ORDER BY r.created_at
$$;

-- Decide on held stock: release it for use, scrap it, or send it back to the supplier.
CREATE OR REPLACE FUNCTION public.resolve_quarantine_hold(
  p_hold_id uuid, p_action text, p_quantity numeric DEFAULT NULL, p_note text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  r public.warehouse_item_reservations%ROWTYPE;
  a public.warehouse_bin_allocations%ROWTYPE;
  v_left numeric;
  v_qty numeric;
  v_bin public.warehouse_bins%ROWTYPE;
  v_label text;
BEGIN
  SELECT * INTO r FROM public.warehouse_item_reservations WHERE id = p_hold_id AND reference_type = 'quarantine' FOR UPDATE;
  IF NOT FOUND OR r.status NOT IN ('active', 'partially_issued') THEN RAISE EXCEPTION 'This held stock has already been dealt with'; END IF;
  SELECT * INTO a FROM public.warehouse_bin_allocations WHERE id = r.bin_allocation_id FOR UPDATE;
  SELECT * INTO v_bin FROM public.warehouse_bins WHERE id = a.bin_id;
  IF NOT public.can_access_company(r.company_id) OR NOT public.can_approve_stock_moves(v_uid)
     OR NOT public.user_location_allowed(v_uid, v_bin.location_id) THEN
    RAISE EXCEPTION 'Held stock is released or written off by a warehouse manager or an admin' USING ERRCODE = '42501';
  END IF;
  IF p_action NOT IN ('release', 'scrap', 'return_to_supplier') THEN RAISE EXCEPTION 'Unknown action %', p_action; END IF;
  IF p_action <> 'release' AND NULLIF(btrim(p_note), '') IS NULL THEN RAISE EXCEPTION 'Add a note saying why'; END IF;

  v_left := r.reserved_quantity - r.quantity_issued;
  v_qty := COALESCE(p_quantity, v_left);
  IF v_qty <= 0 OR v_qty > v_left THEN RAISE EXCEPTION 'Choose a quantity between 0 and %', v_left; END IF;
  v_label := CASE p_action WHEN 'release' THEN 'Released to stock' WHEN 'scrap' THEN 'Scrapped' ELSE 'Returned to supplier' END;

  IF p_action = 'release' THEN
    IF v_qty = v_left AND r.quantity_issued = 0 THEN
      UPDATE public.warehouse_item_reservations SET status = 'cancelled', updated_at = now(),
             notes = concat_ws(E'\n', notes, format('%s %s on %s', v_label, v_qty, to_char(now(), 'YYYY-MM-DD')) || COALESCE(': ' || NULLIF(btrim(p_note), ''), ''))
       WHERE id = r.id;
    ELSE
      UPDATE public.warehouse_item_reservations
         SET reserved_quantity = reserved_quantity - v_qty,
             status = CASE WHEN reserved_quantity - v_qty <= quantity_issued THEN 'issued' ELSE status END,
             updated_at = now(),
             notes = concat_ws(E'\n', notes, format('%s %s on %s', v_label, v_qty, to_char(now(), 'YYYY-MM-DD')) || COALESCE(': ' || NULLIF(btrim(p_note), ''), ''))
       WHERE id = r.id;
    END IF;
    RETURN;
  END IF;

  -- Scrap or return: the quantity leaves the bin.
  UPDATE public.warehouse_item_reservations
     SET quantity_issued = quantity_issued + v_qty,
         status = CASE WHEN quantity_issued + v_qty >= reserved_quantity THEN 'issued' ELSE 'partially_issued' END,
         updated_at = now(),
         notes = concat_ws(E'\n', notes, format('%s %s on %s: %s', v_label, v_qty, to_char(now(), 'YYYY-MM-DD'), btrim(p_note)))
   WHERE id = r.id;
  UPDATE public.warehouse_bin_allocations SET allocated_quantity = allocated_quantity - v_qty, updated_at = now() WHERE id = a.id;

  INSERT INTO public.warehouse_stock_movements (warehouse_item_id, bin_allocation_id, movement_type, reference_type, reference_id,
                                                reference_number, quantity_change, quantity_before, quantity_after, notes, created_by, company_id)
  VALUES (r.warehouse_item_id, a.id, 'adjustment', 'adjustment', r.reference_id, r.reference_number, -v_qty,
          a.allocated_quantity, a.allocated_quantity - v_qty, v_label || ': ' || btrim(p_note), v_uid, r.company_id);
  INSERT INTO public.stock_transactions (item_id, location_id, bin_id, transaction_type, reference_type, reference_id,
                                         quantity_change, notes, company_id, created_by)
  VALUES (r.warehouse_item_id, v_bin.location_id, v_bin.id, 'adjustment', 'mrn', r.reference_id, -v_qty,
          format('%s from %s: %s', v_label, r.reference_number, btrim(p_note)), r.company_id, v_uid);
  PERFORM public.refresh_bin_quantity(v_bin.id);
END;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. Picking and packing
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.can_work_fulfilment(p_company_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT auth.uid() IS NOT NULL AND public.can_access_company(p_company_id)
     AND (public.has_warehouse_access(auth.uid()) OR public.is_admin(auth.uid()))
$$;

-- Recount a sales order's progress and move it along.
CREATE OR REPLACE FUNCTION public.refresh_sales_order_progress(p_sales_order_id uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_status text;
  v_lines integer;
  v_picked integer;
  v_packed integer;
  v_any_picked boolean;
  v_any_packed boolean;
BEGIN
  SELECT status INTO v_status FROM public.sales_orders WHERE id = p_sales_order_id;
  IF v_status IN ('dispatched', 'delivered', 'cancelled') THEN RETURN; END IF;

  SELECT count(*) FILTER (WHERE COALESCE(quantity_issued, 0) > 0),
         count(*) FILTER (WHERE COALESCE(quantity_issued, 0) > 0 AND COALESCE(quantity_picked, 0) >= quantity_issued),
         count(*) FILTER (WHERE COALESCE(quantity_picked, 0) > 0 AND COALESCE(quantity_packed, 0) >= quantity_picked),
         bool_or(COALESCE(quantity_picked, 0) > 0),
         bool_or(COALESCE(quantity_packed, 0) > 0)
    INTO v_lines, v_picked, v_packed, v_any_picked, v_any_packed
    FROM public.sales_order_items WHERE sales_order_id = p_sales_order_id;

  UPDATE public.sales_orders
     SET picked_items = v_picked,
         packed_items = v_packed,
         status = CASE
           WHEN v_lines > 0 AND v_picked = v_lines AND v_packed = v_picked THEN 'packed'
           WHEN v_any_packed THEN 'packing'
           WHEN v_lines > 0 AND v_picked = v_lines THEN 'picked'
           WHEN v_any_picked OR EXISTS (SELECT 1 FROM public.pick_lists WHERE sales_order_id = p_sales_order_id AND status = 'in_progress') THEN 'picking'
           ELSE status END,
         updated_at = now()
   WHERE id = p_sales_order_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.start_pick_list(p_pick_list_id uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_pl public.pick_lists%ROWTYPE;
BEGIN
  SELECT * INTO v_pl FROM public.pick_lists WHERE id = p_pick_list_id FOR UPDATE;
  IF NOT FOUND OR NOT public.can_work_fulfilment(COALESCE(v_pl.company_id, (SELECT company_id FROM public.sales_orders WHERE id = v_pl.sales_order_id))) THEN
    RAISE EXCEPTION 'You can''t work this pick list' USING ERRCODE = '42501';
  END IF;
  IF v_pl.status NOT IN ('pending', 'assigned') THEN RAISE EXCEPTION 'This pick list is already %', replace(v_pl.status, '_', ' '); END IF;
  UPDATE public.pick_lists SET status = 'in_progress', started_at = now(), picker_id = COALESCE(picker_id, auth.uid()), updated_at = now()
   WHERE id = p_pick_list_id;
  PERFORM public.refresh_sales_order_progress(v_pl.sales_order_id);
END;
$$;

-- Record what was picked. p_lines: [{pick_list_item_id, quantity_picked, not_found?, notes?}]
-- Every line on the list is decided; a line picked in full is "picked", less is
-- "short_pick" (or "not_found" when nothing was there).
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
    UPDATE public.sales_order_items SET quantity_picked = COALESCE(quantity_picked, 0) + v_qty, updated_at = now()
     WHERE id = it.sales_order_item_id;
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

-- Pack picked goods. p_lines: [{sales_order_item_id, quantity_packed, package_number?}]
CREATE OR REPLACE FUNCTION public.pack_sales_order(
  p_sales_order_id uuid, p_lines jsonb,
  p_package_type text DEFAULT NULL, p_package_weight numeric DEFAULT NULL,
  p_package_dimensions text DEFAULT NULL, p_notes text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_so public.sales_orders%ROWTYPE;
  v_pl uuid;
  v_number text;
  v_n integer;
  v_line jsonb;
  v_item public.sales_order_items%ROWTYPE;
  v_qty numeric;
  v_count integer := 0;
BEGIN
  SELECT * INTO v_so FROM public.sales_orders WHERE id = p_sales_order_id FOR UPDATE;
  IF NOT FOUND OR NOT public.can_work_fulfilment(v_so.company_id) THEN
    RAISE EXCEPTION 'You can''t pack this order' USING ERRCODE = '42501';
  END IF;
  IF v_so.status NOT IN ('picking', 'picked', 'packing') THEN
    RAISE EXCEPTION 'Order % is %; pack it after picking', v_so.order_number, v_so.status;
  END IF;
  IF jsonb_typeof(p_lines) <> 'array' OR jsonb_array_length(p_lines) = 0 THEN RAISE EXCEPTION 'Enter what goes in the package'; END IF;
  IF p_package_weight IS NOT NULL AND p_package_weight < 0 THEN RAISE EXCEPTION 'Weight can''t be negative'; END IF;

  SELECT count(*) + 1 INTO v_n FROM public.packing_lists WHERE created_at::date = CURRENT_DATE;
  LOOP
    v_number := 'PK-' || to_char(CURRENT_DATE, 'YYYYMMDD') || '-' || lpad(v_n::text, 3, '0');
    EXIT WHEN NOT EXISTS (SELECT 1 FROM public.packing_lists WHERE packing_list_number = v_number);
    v_n := v_n + 1;
  END LOOP;

  INSERT INTO public.packing_lists (packing_list_number, company_id, sales_order_id, pick_list_id, packer_id, status,
                                    package_type, package_weight, package_dimensions, notes, created_by)
  VALUES (v_number, v_so.company_id, p_sales_order_id,
          (SELECT id FROM public.pick_lists WHERE sales_order_id = p_sales_order_id AND status = 'completed' ORDER BY completed_at DESC NULLS LAST LIMIT 1),
          v_uid, 'completed', NULLIF(btrim(p_package_type), ''), p_package_weight, NULLIF(btrim(p_package_dimensions), ''),
          NULLIF(btrim(p_notes), ''), v_uid)
  RETURNING id INTO v_pl;

  FOR v_line IN SELECT * FROM jsonb_array_elements(p_lines) LOOP
    v_qty := COALESCE(NULLIF(v_line->>'quantity_packed', '')::numeric, 0);
    CONTINUE WHEN v_qty = 0;
    SELECT * INTO v_item FROM public.sales_order_items
     WHERE id = NULLIF(v_line->>'sales_order_item_id', '')::uuid AND sales_order_id = p_sales_order_id FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'A line isn''t on order %', v_so.order_number; END IF;
    IF v_qty < 0 OR v_qty > COALESCE(v_item.quantity_picked, 0) - COALESCE(v_item.quantity_packed, 0) THEN
      RAISE EXCEPTION 'Only % of % is picked and not yet packed',
        greatest(COALESCE(v_item.quantity_picked, 0) - COALESCE(v_item.quantity_packed, 0), 0), v_item.item_name;
    END IF;
    INSERT INTO public.packing_list_items (packing_list_id, sales_order_item_id, finished_good_id, quantity_packed, package_number)
    VALUES (v_pl, v_item.id, v_item.finished_good_id, v_qty, COALESCE(NULLIF(v_line->>'package_number', '')::integer, 1));
    UPDATE public.sales_order_items SET quantity_packed = COALESCE(quantity_packed, 0) + v_qty, updated_at = now() WHERE id = v_item.id;
    v_count := v_count + 1;
  END LOOP;
  IF v_count = 0 THEN RAISE EXCEPTION 'Enter a quantity for at least one line'; END IF;

  PERFORM public.refresh_sales_order_progress(p_sales_order_id);
  RETURN jsonb_build_object('packing_list_id', v_pl, 'packing_list_number', v_number,
                            'status', (SELECT status FROM public.sales_orders WHERE id = p_sales_order_id));
END;
$$;

-- "Reset Module" deleted fulfilment records for every company and had no role
-- check. Now: super admins only, one company at a time, finished-goods stock
-- given back for issues that had taken it.
CREATE OR REPLACE FUNCTION public.reset_fulfilment_data(p_company_id uuid)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_orders integer;
BEGIN
  IF NOT public.is_super_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Only a super admin can reset fulfilment data' USING ERRCODE = '42501';
  END IF;
  IF p_company_id IS NULL THEN RAISE EXCEPTION 'Choose the company to reset'; END IF;

  UPDATE public.finished_goods fg
     SET current_stock = fg.current_stock + x.qty, updated_at = now()
    FROM (SELECT fii.finished_good_id, SUM(fii.quantity_issued) AS qty
            FROM public.finished_goods_issue_items fii
            JOIN public.finished_goods_issues fi ON fi.id = fii.issue_id
           WHERE fi.company_id = p_company_id AND fi.status IN ('issued', 'accepted')
           GROUP BY fii.finished_good_id) x
   WHERE fg.id = x.finished_good_id;

  DELETE FROM public.delivery_order_items WHERE do_id IN (SELECT id FROM public.delivery_orders WHERE company_id = p_company_id);
  DELETE FROM public.delivery_orders WHERE company_id = p_company_id;
  DELETE FROM public.packing_list_items WHERE packing_list_id IN (SELECT id FROM public.packing_lists WHERE company_id = p_company_id);
  DELETE FROM public.packing_lists WHERE company_id = p_company_id;
  DELETE FROM public.pick_list_items WHERE pick_list_id IN (SELECT id FROM public.pick_lists WHERE company_id = p_company_id);
  DELETE FROM public.pick_lists WHERE company_id = p_company_id;
  DELETE FROM public.finished_goods_issue_items WHERE issue_id IN (SELECT id FROM public.finished_goods_issues WHERE company_id = p_company_id);
  DELETE FROM public.finished_goods_issues WHERE company_id = p_company_id;
  DELETE FROM public.sales_order_items WHERE sales_order_id IN (SELECT id FROM public.sales_orders WHERE company_id = p_company_id);
  DELETE FROM public.sales_orders WHERE company_id = p_company_id;
  GET DIAGNOSTICS v_orders = ROW_COUNT;
  RETURN jsonb_build_object('sales_orders_deleted', v_orders);
END;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. Grants
-- ─────────────────────────────────────────────────────────────────────────────
DO $$
DECLARE
  f text;
BEGIN
  FOREACH f IN ARRAY ARRAY[
    'public.create_stock_transfer(jsonb, jsonb, boolean)',
    'public.complete_stock_transfer(uuid)',
    'public.move_stock_now(uuid, uuid, uuid, numeric, text, text, date)',
    'public.stock_transfer_block_reason(uuid)',
    'public.list_quarantine_holds(uuid)',
    'public.resolve_quarantine_hold(uuid, text, numeric, text)',
    'public.start_pick_list(uuid)',
    'public.confirm_pick_list(uuid, jsonb)',
    'public.pack_sales_order(uuid, jsonb, text, numeric, text, text)',
    'public.reset_fulfilment_data(uuid)',
    'public.can_approve_stock_moves(uuid)',
    -- used by the triggers above, which run as the signed-in user
    'public.reserve_stock_transfer(uuid, boolean)',
    'public.release_stock_transfer(uuid)'
  ] LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon', f);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated, service_role', f);
  END LOOP;

  FOREACH f IN ARRAY ARRAY[
    'public.move_bin_stock(uuid, uuid, uuid, numeric, uuid, text)',
    'public.refresh_bin_quantity(uuid)',
    'public.refresh_sales_order_progress(uuid)',
    'public.can_work_fulfilment(uuid)'
  ] LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon, authenticated', f);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role', f);
  END LOOP;
END $$;

-- The quick-move screens now use move_stock_now; the old function trusted a
-- user id and company passed by the browser and skipped location checks.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'transfer_stock_fifo' AND pronamespace = 'public'::regnamespace) THEN
    EXECUTE 'REVOKE ALL ON FUNCTION public.transfer_stock_fifo(uuid, uuid, uuid, numeric, uuid, uuid, text, uuid) FROM PUBLIC, anon, authenticated';
  END IF;
END $$;
