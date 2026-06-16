
CREATE OR REPLACE FUNCTION public.enforce_material_return_within_issued()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ref_type text;
  v_ref_id   uuid;
  v_min_id   uuid;
  v_issued   numeric;
  v_returned numeric;
BEGIN
  SELECT reference_type, NULLIF(reference_id, '')::uuid
    INTO v_ref_type, v_ref_id
  FROM public.material_return_notes
  WHERE id = NEW.mrn_id;

  IF v_ref_type IS DISTINCT FROM 'material_issue' OR v_ref_id IS NULL THEN
    RETURN NEW;
  END IF;

  v_min_id := v_ref_id;

  SELECT COALESCE(SUM(quantity_issued), 0)
    INTO v_issued
  FROM public.material_issue_items
  WHERE min_id = v_min_id AND item_id = NEW.item_id;

  SELECT COALESCE(SUM(mri.quantity_returned), 0)
    INTO v_returned
  FROM public.material_return_items mri
  JOIN public.material_return_notes mrn ON mrn.id = mri.mrn_id
  WHERE mrn.reference_type = 'material_issue'
    AND NULLIF(mrn.reference_id, '')::uuid = v_min_id
    AND mri.item_id = NEW.item_id
    AND (TG_OP = 'INSERT' OR mri.id <> NEW.id);

  IF (v_returned + NEW.quantity_returned) > v_issued THEN
    RAISE EXCEPTION
      'Return quantity (% ) exceeds remaining issued qty (%) for item % on this MIN',
      NEW.quantity_returned, GREATEST(v_issued - v_returned, 0), NEW.item_id
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_material_return_within_issued ON public.material_return_items;
CREATE TRIGGER trg_enforce_material_return_within_issued
BEFORE INSERT OR UPDATE OF quantity_returned, item_id, mrn_id
ON public.material_return_items
FOR EACH ROW
EXECUTE FUNCTION public.enforce_material_return_within_issued();
