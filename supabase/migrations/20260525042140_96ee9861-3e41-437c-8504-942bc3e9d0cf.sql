REVOKE EXECUTE ON FUNCTION public.update_material_issue_note_receipt_status() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.update_material_issue_note_receipt_status() FROM anon;
REVOKE EXECUTE ON FUNCTION public.update_material_issue_note_receipt_status() FROM authenticated;

UPDATE public.material_issue_items i
SET
  quantity_received = COALESCE(NULLIF(i.quantity_issued, 0), i.quantity_required, 0),
  received_at = COALESCE(i.received_at, n.received_date, now())
FROM public.material_issue_notes n
WHERE i.min_id = n.id
  AND n.status = 'issued'
  AND n.received_date IS NOT NULL
  AND COALESCE(i.quantity_received, 0) = 0
  AND COALESCE(NULLIF(i.quantity_issued, 0), i.quantity_required, 0) > 0
  AND NOT EXISTS (
    SELECT 1
    FROM public.material_issue_items existing
    WHERE existing.min_id = n.id
      AND COALESCE(existing.quantity_received, 0) > 0
  );