-- Two-step goods issue for Material Issue Notes (MIN).
--
-- Before: approve_material_issue() both converted the reservation to 'issued'
-- AND physically deducted stock; issue_material() deducted stock a SECOND time.
-- Result: approval showed Reserved 0 with on-hand already reduced, and an
-- approved-then-issued MIN double-deducted.
--
-- After (standard two-step goods issue):
--   approve  → status 'approved' only; reservation stays 'active' (reserved
--              remains visible), no stock movement.
--   issue    → release the reservation (active -> issued) AND physically deduct
--              on-hand once. Status 'issued'.

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. approve_material_issue: pure status change. Keep the reservation active.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.approve_material_issue(p_min_id uuid)
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
    RAISE EXCEPTION 'MIN % has no issue location set', v_min.min_number;
  END IF;

  -- Approval is a commitment, NOT a goods movement. The soft-allocation created
  -- at submit stays 'active' so reserved quantity remains visible. Physical
  -- deduction + reservation release happen later in issue_material().
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
-- 2. issue_material: release the line's reservation group (active -> issued),
--    then physically deduct on-hand. Single deduction; reserved drops to 0.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.issue_material(p_min_id uuid)
RETURNS public.material_issue_notes
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_min   public.material_issue_notes;
  v_uid   uuid := auth.uid();
  v_name  text;
  v_item  record;
  v_res   record;
  v_batch_avail numeric;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  IF NOT public.is_min_approver(v_uid) THEN
    RAISE EXCEPTION 'Only admins can post a physical Material Issue';
  END IF;

  SELECT * INTO v_min FROM public.material_issue_notes WHERE id = p_min_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Material Issue Note % not found', p_min_id;
  END IF;

  IF v_min.status <> 'approved' THEN
    RAISE EXCEPTION 'MIN % is not approved (current status: %); cannot post goods issue',
      v_min.min_number, v_min.status;
  END IF;

  IF v_min.location_id IS NULL THEN
    RAISE EXCEPTION 'MIN % has no issue location set; cannot deduct stock', v_min.min_number;
  END IF;

  SELECT COALESCE(p.full_name, u.email)
    INTO v_name
    FROM auth.users u
    LEFT JOIN public.profiles p ON p.id = u.id
   WHERE u.id = v_uid;

  FOR v_item IN
    SELECT id, item_id, quantity_issued, secondary_quantity_issued
      FROM public.material_issue_items
     WHERE min_id = p_min_id
     ORDER BY line_number
  LOOP
    IF v_item.quantity_issued IS NULL OR v_item.quantity_issued <= 0 THEN
      CONTINUE;
    END IF;

    -- Release this line's reservation group (may span several bins) FIRST, so the
    -- bin reserved_quantity drops to 0 (via trigger) and available rises before the
    -- physical deduction's availability check.
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

    -- Location-scoped availability of batched stock for this item
    WITH RECURSIVE loc_tree AS (
      SELECT id FROM public.warehouse_locations WHERE id = v_min.location_id
      UNION ALL
      SELECT wl.id FROM public.warehouse_locations wl JOIN loc_tree t ON wl.parent_id = t.id
    )
    SELECT COALESCE(SUM(LEAST(bsa.allocated_quantity, ib.quantity_remaining)), 0)
      INTO v_batch_avail
    FROM public.batch_stock_allocations bsa
    JOIN public.item_batches ib  ON ib.id = bsa.batch_id
    JOIN public.warehouse_bins wb ON wb.id = bsa.bin_id
    WHERE ib.warehouse_item_id = v_item.item_id
      AND ib.company_id = v_min.company_id
      AND ib.status = 'active'
      AND ib.quantity_remaining > 0
      AND bsa.allocated_quantity > 0
      AND wb.location_id IN (SELECT id FROM loc_tree);

    IF v_batch_avail > 0 THEN
      PERFORM public.process_fifo_batch_issue(
        p_issue_item_id => v_item.id,
        p_item_id       => v_item.item_id,
        p_quantity_issued => v_item.quantity_issued,
        p_company_id    => v_min.company_id,
        p_location_id   => v_min.location_id
      );
    END IF;

    PERFORM public.process_material_issue_stock_update(
      p_item_id                  => v_item.item_id,
      p_quantity_issued          => v_item.quantity_issued,
      p_location_id              => v_min.location_id,
      p_bin_allocation_id        => NULL,
      p_min_id                   => p_min_id,
      p_min_number               => v_min.min_number,
      p_secondary_quantity_issued => v_item.secondary_quantity_issued
    );

    UPDATE public.material_issue_items
       SET issued_at = now(),
           quantity_received = COALESCE(quantity_received, 0)
     WHERE id = v_item.id;
  END LOOP;

  UPDATE public.material_issue_notes
     SET status         = 'issued',
         issued_by      = v_uid,
         issued_by_name = v_name,
         updated_at     = now()
   WHERE id = p_min_id
  RETURNING * INTO v_min;

  RETURN v_min;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.approve_material_issue(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.issue_material(uuid) TO authenticated;
