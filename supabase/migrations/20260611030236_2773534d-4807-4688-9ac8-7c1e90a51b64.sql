
-- 1. Reason code enum
DO $$ BEGIN
  CREATE TYPE public.grn_rejection_reason AS ENUM (
    'damaged_in_transit',
    'quantity_short',
    'quantity_over',
    'wrong_item',
    'quality_failure',
    'expired_or_near_expiry',
    'missing_documentation',
    'late_delivery',
    'packaging_non_conformance',
    'supplier_non_conformance',
    'other'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 2. Columns
ALTER TABLE public.goods_receipt_notes
  ADD COLUMN IF NOT EXISTS rejection_reason public.grn_rejection_reason,
  ADD COLUMN IF NOT EXISTS rejection_notes text,
  ADD COLUMN IF NOT EXISTS rejected_by uuid REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS rejected_date timestamptz;

-- 3. Guard trigger: admin-only rejection + required reason/notes + only from submitted
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

  -- Block any transition out of rejected (terminal state)
  IF COALESCE(OLD.status, '') = 'rejected' AND NEW.status <> 'rejected' THEN
    RAISE EXCEPTION 'Rejected GRNs cannot be re-opened';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_grn_admin_rejection ON public.goods_receipt_notes;
CREATE TRIGGER trg_enforce_grn_admin_rejection
  BEFORE UPDATE ON public.goods_receipt_notes
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_grn_admin_rejection();

-- 4. Atomic RPC
CREATE OR REPLACE FUNCTION public.reject_goods_receipt_note(
  _grn_id uuid,
  _reason public.grn_rejection_reason,
  _notes text DEFAULT NULL
)
RETURNS public.goods_receipt_notes
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _row public.goods_receipt_notes;
BEGIN
  IF NOT public.is_admin_or_higher(auth.uid()) THEN
    RAISE EXCEPTION 'Only admins can reject a GRN';
  END IF;

  UPDATE public.goods_receipt_notes
     SET status = 'rejected',
         rejection_reason = _reason,
         rejection_notes = NULLIF(btrim(COALESCE(_notes, '')), ''),
         rejected_by = auth.uid(),
         rejected_date = now(),
         updated_at = now()
   WHERE id = _grn_id
   RETURNING * INTO _row;

  IF _row.id IS NULL THEN
    RAISE EXCEPTION 'GRN not found: %', _grn_id;
  END IF;

  RETURN _row;
END;
$$;

REVOKE ALL ON FUNCTION public.reject_goods_receipt_note(uuid, public.grn_rejection_reason, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.reject_goods_receipt_note(uuid, public.grn_rejection_reason, text) TO authenticated;
