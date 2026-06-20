
-- Reopen RPCs: send rejected MIN/GRN back to draft so creator can fix and resubmit.
-- SAP/Oracle/D365 standard: rejection unlocks the document for the creator.

CREATE OR REPLACE FUNCTION public.reopen_material_issue_draft(p_min_id uuid)
RETURNS public.material_issue_notes
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _row public.material_issue_notes;
BEGIN
  SELECT * INTO _row FROM public.material_issue_notes WHERE id = p_min_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Material Issue Note not found';
  END IF;

  IF _row.status <> 'rejected' THEN
    RAISE EXCEPTION 'Only rejected MINs can be reopened (current status: %)', _row.status;
  END IF;

  IF NOT (auth.uid() = _row.created_by OR public.is_admin(auth.uid())) THEN
    RAISE EXCEPTION 'Only the creator or an admin can reopen this MIN';
  END IF;

  UPDATE public.material_issue_notes
     SET status = 'draft',
         approved_by = NULL,
         approved_date = NULL,
         updated_at = now()
   WHERE id = p_min_id
  RETURNING * INTO _row;

  RETURN _row;
END;
$$;

REVOKE ALL ON FUNCTION public.reopen_material_issue_draft(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.reopen_material_issue_draft(uuid) TO authenticated;

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

  UPDATE public.goods_receipt_notes
     SET status = 'draft',
         updated_at = now()
   WHERE id = p_grn_id
  RETURNING * INTO _row;

  RETURN _row;
END;
$$;

REVOKE ALL ON FUNCTION public.reopen_grn_draft(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.reopen_grn_draft(uuid) TO authenticated;
