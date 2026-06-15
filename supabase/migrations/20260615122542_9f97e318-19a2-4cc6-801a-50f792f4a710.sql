CREATE OR REPLACE FUNCTION public.issue_material(p_min_id uuid)
 RETURNS material_issue_notes
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_min   public.material_issue_notes;
  v_uid   uuid := auth.uid();
  v_name  text;
  v_item  record;
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

    -- Only run FIFO when the item actually has active batch stock.
    -- Items received without batch tracking still deduct via bin/location below.
    SELECT COALESCE(SUM(quantity_remaining), 0)
      INTO v_batch_avail
      FROM public.item_batches
     WHERE warehouse_item_id = v_item.item_id
       AND company_id = v_min.company_id
       AND status = 'active'
       AND quantity_remaining > 0;

    IF v_batch_avail > 0 THEN
      PERFORM public.process_fifo_batch_issue(
        p_issue_item_id => v_item.id,
        p_item_id       => v_item.item_id,
        p_quantity_issued => v_item.quantity_issued,
        p_company_id    => v_min.company_id
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