CREATE OR REPLACE FUNCTION public.update_material_issue_note_receipt_status()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_min_id uuid;
  v_total_items integer;
  v_received_items integer;
  v_fully_received_items integer;
  v_all_received boolean;
  v_new_status text;
BEGIN
  v_min_id := COALESCE(NEW.min_id, OLD.min_id);

  SELECT
    COUNT(*),
    COUNT(*) FILTER (WHERE COALESCE(quantity_received, 0) > 0),
    COUNT(*) FILTER (
      WHERE COALESCE(quantity_received, 0) >= COALESCE(NULLIF(quantity_issued, 0), quantity_required, 0)
        AND COALESCE(NULLIF(quantity_issued, 0), quantity_required, 0) > 0
    )
  INTO v_total_items, v_received_items, v_fully_received_items
  FROM public.material_issue_items
  WHERE min_id = v_min_id;

  v_all_received := v_total_items > 0 AND v_fully_received_items = v_total_items;

  v_new_status := CASE
    WHEN v_all_received THEN 'completed'
    WHEN v_received_items > 0 THEN 'partially_received'
    ELSE 'issued'
  END;

  UPDATE public.material_issue_notes
  SET
    status = CASE
      WHEN status IN ('issued', 'partially_received', 'completed') THEN v_new_status
      ELSE status
    END,
    order_completed = v_all_received,
    received_date = CASE
      WHEN v_received_items > 0 THEN COALESCE(received_date, now())
      ELSE received_date
    END,
    updated_at = now()
  WHERE id = v_min_id;

  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trigger_update_material_issue_note_receipt_status ON public.material_issue_items;

CREATE TRIGGER trigger_update_material_issue_note_receipt_status
AFTER INSERT OR UPDATE OF quantity_received OR DELETE ON public.material_issue_items
FOR EACH ROW
EXECUTE FUNCTION public.update_material_issue_note_receipt_status();