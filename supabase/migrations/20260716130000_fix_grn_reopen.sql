-- Fix: "Reopen as Draft" on a rejected GRN failed with "Rejected GRNs cannot
-- be re-opened".
--
-- reopen_grn_draft (20260620) performs the authorized rejected → draft
-- transition (creator or admin), but the older rejection guard (20260611)
-- hard-blocks ANY transition out of 'rejected' — the reopen feature was added
-- without updating the guard. Mirror the app.grn_allocating pattern: the RPC
-- sets a transaction-local flag, and the guard admits rejected → draft only
-- when that flag is present. Direct status edits remain blocked.

CREATE OR REPLACE FUNCTION public.enforce_grn_admin_rejection()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'rejected' AND COALESCE(OLD.status, '') <> 'rejected' THEN
    IF NOT public.is_admin_or_higher(auth.uid()) THEN
      RAISE EXCEPTION 'Only admins can reject a GRN';
    END IF;
    IF COALESCE(OLD.status, '') <> 'submitted' THEN
      RAISE EXCEPTION 'Only submitted GRNs can be rejected (current status: %)', OLD.status;
    END IF;
    IF NEW.rejection_reason IS NULL THEN
      RAISE EXCEPTION 'rejection_reason is required when rejecting a GRN';
    END IF;
    IF NEW.rejection_reason = 'other'
       AND (NEW.rejection_notes IS NULL OR length(btrim(NEW.rejection_notes)) = 0) THEN
      RAISE EXCEPTION 'rejection_notes is required when rejection_reason is "other"';
    END IF;
    NEW.rejected_by := COALESCE(NEW.rejected_by, auth.uid());
    NEW.rejected_date := COALESCE(NEW.rejected_date, now());
  END IF;

  -- Transitions out of 'rejected' are allowed only through reopen_grn_draft
  -- (which authorizes creator/admin and flags the transaction). Anything else
  -- — including hand-editing the status — stays blocked.
  IF COALESCE(OLD.status, '') = 'rejected' AND NEW.status <> 'rejected' THEN
    IF NOT (NEW.status = 'draft'
            AND COALESCE(current_setting('app.grn_reopening', true), '') = '1') THEN
      RAISE EXCEPTION 'Rejected GRNs can only be reopened as draft via Reopen as Draft';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.reopen_grn_draft(p_grn_id uuid)
RETURNS public.goods_receipt_notes
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _row public.goods_receipt_notes;
BEGIN
  SELECT * INTO _row FROM public.goods_receipt_notes WHERE id = p_grn_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'GRN not found';
  END IF;

  IF _row.status <> 'rejected' THEN
    RAISE EXCEPTION 'Only rejected GRNs can be reopened (current status: %)', _row.status;
  END IF;

  IF NOT (auth.uid() = _row.created_by OR public.is_admin(auth.uid())) THEN
    RAISE EXCEPTION 'Only the creator or an admin can reopen this GRN';
  END IF;

  PERFORM set_config('app.grn_reopening', '1', true);

  -- Clear the rejection stamp so a future rejection records fresh facts
  -- (the guard COALESCEs rejected_by/date and would keep the stale ones).
  UPDATE public.goods_receipt_notes
     SET status = 'draft',
         rejection_reason = NULL,
         rejection_notes = NULL,
         rejected_by = NULL,
         rejected_date = NULL,
         updated_at = now()
   WHERE id = p_grn_id
  RETURNING * INTO _row;

  RETURN _row;
END;
$$;

REVOKE ALL ON FUNCTION public.reopen_grn_draft(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.reopen_grn_draft(uuid) TO authenticated;
