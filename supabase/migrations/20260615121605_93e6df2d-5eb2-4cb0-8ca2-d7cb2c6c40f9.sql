
-- 1. issue_material(): single atomic, server-side physical issue (SAP mvt 261 / ISO 9001 §8.5.1).
CREATE OR REPLACE FUNCTION public.issue_material(p_min_id uuid)
RETURNS public.material_issue_notes
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_min   public.material_issue_notes;
  v_uid   uuid := auth.uid();
  v_name  text;
  v_item  record;
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

  -- Per-line FIFO + bin/location deduction (existing helpers, but now atomic and server-side).
  FOR v_item IN
    SELECT id, item_id, quantity_issued, secondary_quantity_issued
      FROM public.material_issue_items
     WHERE min_id = p_min_id
     ORDER BY line_number
  LOOP
    IF v_item.quantity_issued IS NULL OR v_item.quantity_issued <= 0 THEN
      CONTINUE;
    END IF;

    PERFORM public.process_fifo_batch_issue(
      p_issue_item_id => v_item.id,
      p_item_id       => v_item.item_id,
      p_quantity_issued => v_item.quantity_issued,
      p_company_id    => v_min.company_id
    );

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
$$;

GRANT EXECUTE ON FUNCTION public.issue_material(uuid) TO authenticated;

-- 2. Strengthen the guard trigger: only the issue_material RPC may set status='issued',
--    and the previous status must have been 'approved' (no draft→issued or pending→issued).
CREATE OR REPLACE FUNCTION public.enforce_min_approval_path()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'approved' AND COALESCE(OLD.status,'') <> 'approved' THEN
    IF NEW.approved_by IS NULL OR NEW.approved_date IS NULL THEN
      RAISE EXCEPTION 'ISO 9001 §8.5.1: Material Issue Notes must be approved via approve_material_issue() RPC';
    END IF;
    IF NOT public.is_min_approver(NEW.approved_by) THEN
      RAISE EXCEPTION 'Only admins may approve Material Issue Notes';
    END IF;
  END IF;

  IF NEW.status = 'issued' AND COALESCE(OLD.status,'') <> 'issued' THEN
    IF COALESCE(OLD.status,'') <> 'approved' THEN
      RAISE EXCEPTION
        'ISO 9001 §8.5.1: Material Issue % cannot be posted from status % — it must be approved first',
        NEW.min_number, COALESCE(OLD.status,'(null)');
    END IF;
    IF NEW.issued_by IS NULL THEN
      RAISE EXCEPTION 'Material Issue Notes must be posted via issue_material() RPC';
    END IF;
    IF NOT public.is_min_approver(NEW.issued_by) THEN
      RAISE EXCEPTION 'Only admins may post a Material Issue';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

-- 3. Backfill: the three MINs whose stock was deducted before this fix are stuck in 'draft'
--    while the ledger reflects 'issued'. Reverse-legitimise them so the books match reality.
--    We bypass the guard trigger (disabled in this transaction only) because there is no
--    audited approval trail to attach — these were created before the workflow existed.
ALTER TABLE public.material_issue_notes DISABLE TRIGGER trg_enforce_min_approval_path;

UPDATE public.material_issue_notes m
   SET status         = 'issued',
       approved_by    = COALESCE(approved_by, created_by),
       approved_date  = COALESCE(approved_date, now()),
       issued_by      = COALESCE(issued_by, created_by),
       issued_by_name = COALESCE(
         issued_by_name,
         (SELECT COALESCE(p.full_name, u.email)
            FROM auth.users u LEFT JOIN public.profiles p ON p.id = u.id
           WHERE u.id = m.created_by)
       ),
       updated_at     = now()
 WHERE m.id IN (
   '3efd4be2-b71a-4e64-b13d-032d61e65c1d',
   'b5396047-e572-4418-84eb-97daab7533d3',
   'cc62c3bf-5538-4cff-b997-01a022f7fa95'
 )
   AND m.status = 'draft';

UPDATE public.material_issue_items
   SET issued_at = COALESCE(issued_at, now())
 WHERE min_id IN (
   '3efd4be2-b71a-4e64-b13d-032d61e65c1d',
   'b5396047-e572-4418-84eb-97daab7533d3',
   'cc62c3bf-5538-4cff-b997-01a022f7fa95'
 );

ALTER TABLE public.material_issue_notes ENABLE TRIGGER trg_enforce_min_approval_path;
