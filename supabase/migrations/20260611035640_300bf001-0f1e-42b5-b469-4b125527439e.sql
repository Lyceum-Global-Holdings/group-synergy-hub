-- Enforce: GRN must have at least one line item before submission/approval (SAP MM standard)
CREATE OR REPLACE FUNCTION public.enforce_grn_has_items()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count integer;
BEGIN
  IF NEW.status IN ('submitted','approved','completed')
     AND (OLD.status IS DISTINCT FROM NEW.status) THEN
    SELECT count(*) INTO v_count FROM grn_items WHERE grn_id = NEW.id;
    IF v_count = 0 THEN
      RAISE EXCEPTION 'Cannot transition GRN % to %: no line items exist. Add at least one item first.',
        NEW.grn_number, NEW.status
        USING ERRCODE = 'check_violation';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_grn_has_items ON public.goods_receipt_notes;
CREATE TRIGGER trg_enforce_grn_has_items
  BEFORE UPDATE ON public.goods_receipt_notes
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_grn_has_items();

-- Cancel the orphan GRN that was submitted with zero items (pre-fix data)
UPDATE public.goods_receipt_notes
SET status = 'cancelled',
    remarks = COALESCE(remarks || E'\n', '') || '[Auto-cancelled: submitted with zero line items before validation existed]'
WHERE status = 'submitted'
  AND NOT EXISTS (SELECT 1 FROM grn_items WHERE grn_id = goods_receipt_notes.id);