-- Material Issue Note (MIN) stock reservation / soft-allocation.
--
-- Goal: when a MIN is submitted for approval, soft-allocate (reserve) the
-- required quantity at bin level so Available = OnHand - Reserved drops and the
-- same stock can't be double-promised. When the MIN is cancelled / rejected /
-- reopened / deleted, release the reservation. Physical stock is still only
-- deducted at approval (ISO 9001 §8.5.1 segregation of duties).
--
-- The reservation engine already exists (warehouse_item_reservations +
-- warehouse_bin_allocations.reserved_quantity, maintained by triggers in
-- 20251028191402). This migration wires the MIN lifecycle into it.

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. Schema
-- ─────────────────────────────────────────────────────────────────────────────

-- 1a. Allow 'material_issue' as a reservation reference type.
ALTER TABLE public.warehouse_item_reservations
  DROP CONSTRAINT IF EXISTS warehouse_item_reservations_reference_type_check;
ALTER TABLE public.warehouse_item_reservations
  ADD CONSTRAINT warehouse_item_reservations_reference_type_check
  CHECK (reference_type IN ('cpo','material_request','production_order',
                            'sales_order','manual','material_issue'));

-- 1b. Exact line -> reservations linkage (one MIN line can FIFO-span many bins,
--     so the single material_issue_items.reservation_id column is insufficient).
ALTER TABLE public.warehouse_item_reservations
  ADD COLUMN IF NOT EXISTS min_item_id uuid
    REFERENCES public.material_issue_items(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS idx_item_reservations_min_item
  ON public.warehouse_item_reservations(min_item_id);
CREATE INDEX IF NOT EXISTS idx_item_reservations_min_ref
  ON public.warehouse_item_reservations(reference_type, reference_id);

-- 1c. Cancellation audit columns on the MIN.
ALTER TABLE public.material_issue_notes
  ADD COLUMN IF NOT EXISTS cancelled_at timestamptz,
  ADD COLUMN IF NOT EXISTS cancelled_by uuid,
  ADD COLUMN IF NOT EXISTS cancellation_reason text;

-- ─────────────────────────────────────────────────────────────────────────────
-- 1d. Repair update_warehouse_item_reservations().
--     A past migration clobbered this trigger function with a body meant for a
--     different table — it referenced NEW.item_id / quantity_reserved / status
--     'pending', none of which exist here (the columns are warehouse_item_id /
--     reserved_quantity, status 'partially_issued'). The result: EVERY write to
--     warehouse_item_reservations failed ("record new has no field item_id"),
--     so no reservation (CPO or MIN) could ever be created. Restore the correct
--     body (matching 20251028191402).
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.update_warehouse_item_reservations()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE warehouse_items
  SET reserved_quantity = (
    SELECT COALESCE(SUM(reserved_quantity - quantity_issued), 0)
    FROM warehouse_item_reservations
    WHERE warehouse_item_id = COALESCE(NEW.warehouse_item_id, OLD.warehouse_item_id)
      AND status IN ('active', 'partially_issued')
  )
  WHERE id = COALESCE(NEW.warehouse_item_id, OLD.warehouse_item_id);

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. Harden the bin-reserved trigger to also recompute on DELETE.
--    (Original fires on INSERT/UPDATE only; a deleted reservation row would
--    otherwise leave warehouse_bin_allocations.reserved_quantity stale.)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.update_bin_allocation_reservations()
RETURNS TRIGGER AS $$
BEGIN
  IF (TG_OP <> 'DELETE') AND NEW.bin_allocation_id IS NOT NULL THEN
    UPDATE warehouse_bin_allocations
    SET reserved_quantity = (
      SELECT COALESCE(SUM(reserved_quantity - quantity_issued), 0)
      FROM warehouse_item_reservations
      WHERE bin_allocation_id = NEW.bin_allocation_id
        AND status IN ('active', 'partially_issued')
    )
    WHERE id = NEW.bin_allocation_id;
  END IF;

  IF (TG_OP IN ('UPDATE','DELETE')) AND OLD.bin_allocation_id IS NOT NULL
     AND (TG_OP = 'DELETE' OR OLD.bin_allocation_id IS DISTINCT FROM NEW.bin_allocation_id) THEN
    UPDATE warehouse_bin_allocations
    SET reserved_quantity = (
      SELECT COALESCE(SUM(reserved_quantity - quantity_issued), 0)
      FROM warehouse_item_reservations
      WHERE bin_allocation_id = OLD.bin_allocation_id
        AND status IN ('active', 'partially_issued')
    )
    WHERE id = OLD.bin_allocation_id;
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_update_bin_reservations ON public.warehouse_item_reservations;
CREATE TRIGGER trg_update_bin_reservations
AFTER INSERT OR UPDATE OR DELETE ON public.warehouse_item_reservations
FOR EACH ROW
EXECUTE FUNCTION public.update_bin_allocation_reservations();

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. Fix update_reservation_on_issue.
--    The prior version wrote the GENERATED column quantity_remaining and cast to
--    a non-existent reservation_status enum — both error against the live schema.
--    This version sets only quantity_issued + status (text); item/bin reserved
--    quantities are recomputed by the existing triggers.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.update_reservation_on_issue(
  p_reservation_id uuid,
  p_quantity_issued numeric
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_res warehouse_item_reservations%ROWTYPE;
  v_new_issued numeric;
  v_new_status text;
BEGIN
  SELECT * INTO v_res FROM warehouse_item_reservations WHERE id = p_reservation_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Reservation not found: %', p_reservation_id;
  END IF;

  v_new_issued := COALESCE(v_res.quantity_issued, 0) + COALESCE(p_quantity_issued, 0);
  v_new_issued := LEAST(v_new_issued, v_res.reserved_quantity);  -- respect valid_issued_qty CHECK

  IF v_new_issued >= v_res.reserved_quantity THEN
    v_new_status := 'issued';
  ELSIF v_new_issued > 0 THEN
    v_new_status := 'partially_issued';
  ELSE
    v_new_status := v_res.status;
  END IF;

  UPDATE warehouse_item_reservations
     SET quantity_issued = v_new_issued,
         status          = v_new_status,
         updated_at      = now()
   WHERE id = p_reservation_id;
END;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. release_material_issue_reservations — single reusable release primitive.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.release_material_issue_reservations(p_min_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Cancelling active reservations restores reserved_quantity via triggers.
  UPDATE warehouse_item_reservations
     SET status = 'cancelled', updated_at = now()
   WHERE reference_type = 'material_issue'
     AND reference_id   = p_min_id
     AND status IN ('active', 'partially_issued');

  -- Clear line linkage so the MIN no longer points at released reservations.
  UPDATE material_issue_items
     SET from_reservation = false, reservation_id = NULL
   WHERE min_id = p_min_id;
END;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 5. reserve_material_issue — idempotent soft-allocation at bin level.
--    Returns a JSON shortfall report; does NOT block on insufficient stock
--    (reserves whatever is available, FIFO across bins at the MIN location tree).
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.reserve_material_issue(p_min_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_min      public.material_issue_notes;
  v_uid      uuid := auth.uid();
  v_item     RECORD;
  v_alloc    RECORD;
  v_need     numeric;
  v_take     numeric;
  v_res_id   uuid;
  v_first    uuid;
  v_requested numeric;
  v_report   jsonb := '[]'::jsonb;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  SELECT * INTO v_min FROM public.material_issue_notes WHERE id = p_min_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Material Issue Note % not found', p_min_id;
  END IF;
  IF v_min.location_id IS NULL THEN
    RAISE EXCEPTION 'MIN % has no issue location set; cannot reserve stock', v_min.min_number;
  END IF;
  IF v_min.status NOT IN ('draft', 'pending_approval') THEN
    RAISE EXCEPTION 'MIN % cannot reserve stock from status %', v_min.min_number, v_min.status;
  END IF;

  -- Idempotency: drop any previously-created active reservations for this MIN.
  PERFORM public.release_material_issue_reservations(p_min_id);

  FOR v_item IN
    SELECT * FROM public.material_issue_items
    WHERE min_id = p_min_id
    ORDER BY line_number NULLS LAST, created_at
  LOOP
    v_requested := COALESCE(v_item.quantity_required, v_item.quantity_issued, 0);
    v_need := v_requested;
    v_first := NULL;

    IF v_need > 0 THEN
      FOR v_alloc IN
        WITH RECURSIVE loc_tree AS (
          SELECT id FROM warehouse_locations WHERE id = v_min.location_id
          UNION ALL
          SELECT wl.id FROM warehouse_locations wl JOIN loc_tree t ON wl.parent_id = t.id
        )
        SELECT wba.id AS alloc_id,
               GREATEST(0, wba.allocated_quantity - COALESCE(wba.reserved_quantity, 0)) AS avail
        FROM warehouse_bin_allocations wba
        JOIN warehouse_bins wb ON wb.id = wba.bin_id
        WHERE wba.warehouse_item_id = v_item.item_id
          AND wb.location_id IN (SELECT id FROM loc_tree)
          AND wba.allocated_quantity > 0
        ORDER BY wba.created_at ASC
        FOR UPDATE OF wba
      LOOP
        EXIT WHEN v_need <= 0;
        v_take := LEAST(v_alloc.avail, v_need);
        IF v_take <= 0 THEN CONTINUE; END IF;

        INSERT INTO public.warehouse_item_reservations (
          warehouse_item_id, bin_allocation_id, reserved_quantity,
          reference_type, reference_id, reference_number, min_item_id,
          status, reserved_by, company_id, required_date
        ) VALUES (
          v_item.item_id, v_alloc.alloc_id, v_take,
          'material_issue', p_min_id, v_min.min_number, v_item.id,
          'active', v_uid, v_min.company_id, v_min.items_required_date
        )
        RETURNING id INTO v_res_id;            -- trigger raises bin.reserved_quantity here

        v_first := COALESCE(v_first, v_res_id);
        v_need  := v_need - v_take;
      END LOOP;
    END IF;

    UPDATE public.material_issue_items
       SET from_reservation = (v_first IS NOT NULL),
           reservation_id   = v_first
     WHERE id = v_item.id;

    IF v_need > 0 THEN
      v_report := v_report || jsonb_build_object(
        'min_item_id', v_item.id,
        'item_id',     v_item.item_id,
        'item_code',   v_item.item_code,
        'description', v_item.description,
        'requested',   v_requested,
        'reserved',    v_requested - v_need,
        'shortfall',   v_need
      );
    END IF;
  END LOOP;

  RETURN jsonb_build_object(
    'min_id',     p_min_id,
    'min_number', v_min.min_number,
    'shortfalls', v_report
  );
END;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 6. cancel_material_issue — new cancel path (none existed). Releases stock.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.cancel_material_issue(p_min_id uuid, p_reason text DEFAULT NULL)
RETURNS public.material_issue_notes
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_min public.material_issue_notes;
  v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  SELECT * INTO v_min FROM public.material_issue_notes WHERE id = p_min_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Material Issue Note % not found', p_min_id;
  END IF;

  -- Cannot cancel once physical stock has moved.
  IF v_min.status NOT IN ('draft','pending_approval','approved','rejected') THEN
    RAISE EXCEPTION 'MIN % cannot be cancelled from status % (stock already issued)',
      v_min.min_number, v_min.status;
  END IF;

  PERFORM public.release_material_issue_reservations(p_min_id);

  UPDATE public.material_issue_notes
     SET status              = 'cancelled',
         cancelled_at        = now(),
         cancelled_by        = v_uid,
         cancellation_reason = NULLIF(btrim(COALESCE(p_reason, '')), ''),
         updated_at          = now()
   WHERE id = p_min_id
  RETURNING * INTO v_min;

  RETURN v_min;
END;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 7. approve_material_issue — convert each line's reservation group (active ->
--    issued) before deducting physical stock. Pass p_bin_allocation_id => NULL so
--    the issue FIFO spans the same bins/order the reservation used (the 6-arg
--    process_material_issue_stock_update RESTRICTS to one bin when an id is given,
--    which would break multi-bin lines).
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.approve_material_issue(p_min_id uuid)
RETURNS public.material_issue_notes
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_min  public.material_issue_notes;
  v_uid  uuid := auth.uid();
  v_item RECORD;
  v_res  RECORD;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  IF NOT public.is_min_approver(v_uid) THEN
    RAISE EXCEPTION 'Only admins can approve Material Issue Notes';
  END IF;

  SELECT * INTO v_min FROM public.material_issue_notes WHERE id = p_min_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Material Issue Note % not found', p_min_id;
  END IF;

  IF v_min.status <> 'pending_approval' THEN
    RAISE EXCEPTION 'MIN % is not pending approval (current status: %)', v_min.min_number, v_min.status;
  END IF;

  IF v_min.location_id IS NULL THEN
    RAISE EXCEPTION 'MIN % has no issue location set; cannot deduct stock', v_min.min_number;
  END IF;

  FOR v_item IN
    SELECT * FROM public.material_issue_items
    WHERE min_id = p_min_id
    ORDER BY line_number NULLS LAST, created_at
  LOOP
    -- Convert this line's reservation group (may span several bins) to issued.
    -- Each conversion releases that bin's reserved_quantity via trigger, so the
    -- subsequent physical deduction doesn't double-count.
    FOR v_res IN
      SELECT id, reserved_quantity, quantity_issued
      FROM public.warehouse_item_reservations
      WHERE min_item_id = v_item.id
        AND reference_type = 'material_issue'
        AND status IN ('active', 'partially_issued')
      ORDER BY created_at
    LOOP
      PERFORM public.update_reservation_on_issue(
        v_res.id,
        v_res.reserved_quantity - COALESCE(v_res.quantity_issued, 0)
      );
    END LOOP;

    PERFORM public.process_material_issue_stock_update(
      p_item_id                    => v_item.item_id,
      p_quantity_issued            => v_item.quantity_issued,
      p_location_id                => v_min.location_id,
      p_bin_allocation_id          => NULL,
      p_min_id                     => p_min_id,
      p_min_number                 => v_min.min_number,
      p_secondary_quantity_issued  => v_item.secondary_quantity_issued
    );
  END LOOP;

  UPDATE public.material_issue_notes
     SET status        = 'approved',
         approved_by   = v_uid,
         approved_date = now(),
         updated_at    = now()
   WHERE id = p_min_id
  RETURNING * INTO v_min;

  RETURN v_min;
END;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 8. Centralised release on lifecycle transitions (reject / cancel / reopen).
--    Approval is excluded — it converts reservations to 'issued' instead.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.release_min_reservations_on_status_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.status IN ('rejected', 'cancelled')
     AND COALESCE(OLD.status, '') NOT IN ('rejected', 'cancelled') THEN
    PERFORM public.release_material_issue_reservations(NEW.id);
  ELSIF NEW.status = 'draft' AND OLD.status = 'rejected' THEN
    -- Reopen-to-draft: ensure nothing stays reserved.
    PERFORM public.release_material_issue_reservations(NEW.id);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_min_release_on_status ON public.material_issue_notes;
CREATE TRIGGER trg_min_release_on_status
AFTER UPDATE OF status ON public.material_issue_notes
FOR EACH ROW
WHEN (NEW.status IS DISTINCT FROM OLD.status)
EXECUTE FUNCTION public.release_min_reservations_on_status_change();

-- 8b. Release on hard delete (e.g. deleting a draft directly).
CREATE OR REPLACE FUNCTION public.release_min_reservations_before_delete()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  PERFORM public.release_material_issue_reservations(OLD.id);
  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS trg_min_release_before_delete ON public.material_issue_notes;
CREATE TRIGGER trg_min_release_before_delete
BEFORE DELETE ON public.material_issue_notes
FOR EACH ROW
EXECUTE FUNCTION public.release_min_reservations_before_delete();

-- ─────────────────────────────────────────────────────────────────────────────
-- 9. Reserve on EVERY submit path (server-side), so soft-allocation can't be
--    skipped by submitting from the list instead of the create dialog.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.submit_material_issue_for_approval(p_min_id uuid)
RETURNS public.material_issue_notes
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_min public.material_issue_notes;
  v_uid uuid := auth.uid();
  v_item_count int;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  SELECT * INTO v_min FROM public.material_issue_notes WHERE id = p_min_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Material Issue Note % not found', p_min_id;
  END IF;

  IF v_min.status NOT IN ('draft','pending_approval') THEN
    RAISE EXCEPTION 'MIN % cannot be submitted from status %', v_min.min_number, v_min.status;
  END IF;

  SELECT COUNT(*) INTO v_item_count FROM public.material_issue_items WHERE min_id = p_min_id;
  IF v_item_count = 0 THEN
    RAISE EXCEPTION 'Cannot submit an empty Material Issue Note';
  END IF;

  UPDATE public.material_issue_notes
     SET status        = 'pending_approval',
         submitted_at  = COALESCE(submitted_at, now()),
         submitted_by  = COALESCE(submitted_by, v_uid),
         updated_at    = now()
   WHERE id = p_min_id
  RETURNING * INTO v_min;

  -- Soft-allocate stock at bin level (idempotent). Shortfalls are tolerated;
  -- physical availability is re-checked at approval.
  PERFORM public.reserve_material_issue(p_min_id);

  RETURN v_min;
END;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 10. Grants
-- ─────────────────────────────────────────────────────────────────────────────
GRANT EXECUTE ON FUNCTION public.reserve_material_issue(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.release_material_issue_reservations(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.cancel_material_issue(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.submit_material_issue_for_approval(uuid) TO authenticated;
