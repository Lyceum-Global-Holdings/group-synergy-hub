CREATE OR REPLACE FUNCTION public.approve_material_issue(p_min_id uuid)
 RETURNS material_issue_notes
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_min  public.material_issue_notes;
  v_uid  uuid := auth.uid();
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

  -- Approval only stamps the authorisation. Stock is deducted later in a
  -- separate physical-issue step (ISO 9001 §8.5.1 segregation between
  -- authorisation and execution).
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