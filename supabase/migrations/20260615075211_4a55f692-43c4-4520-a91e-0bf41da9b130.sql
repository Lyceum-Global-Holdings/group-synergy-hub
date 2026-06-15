CREATE OR REPLACE FUNCTION public.approve_material_issue(p_min_id uuid)
 RETURNS material_issue_notes
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_min  public.material_issue_notes;
  v_uid  uuid := auth.uid();
  v_item RECORD;
  v_bin_alloc_id uuid;
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
    IF v_item.from_reservation = true AND v_item.reservation_id IS NOT NULL THEN
      PERFORM public.update_reservation_on_issue(
        p_reservation_id  => v_item.reservation_id,
        p_quantity_issued => v_item.quantity_issued
      );
    END IF;

    v_bin_alloc_id := NULL;
    IF v_item.reservation_id IS NOT NULL THEN
      SELECT bin_allocation_id INTO v_bin_alloc_id
      FROM public.warehouse_item_reservations
      WHERE id = v_item.reservation_id;
    END IF;

    PERFORM public.process_material_issue_stock_update(
      p_item_id                    => v_item.item_id,
      p_quantity_issued            => v_item.quantity_issued,
      p_location_id                => v_min.location_id,
      p_bin_allocation_id          => v_bin_alloc_id,
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
$function$;