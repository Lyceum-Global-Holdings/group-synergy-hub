CREATE OR REPLACE FUNCTION public.get_min_returnable_lines(p_min_id uuid)
RETURNS TABLE(item_id uuid, item_code text, item_name text, unit_of_measure text, qty_issued numeric, qty_returned_prev numeric, remaining numeric, unit_cost numeric)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_company uuid;
BEGIN
  SELECT company_id INTO v_company
  FROM public.material_issue_notes
  WHERE id = p_min_id;

  IF v_company IS NULL THEN
    RETURN;
  END IF;

  IF NOT public.can_access_company(v_company) THEN
    RETURN;
  END IF;

  RETURN QUERY
  WITH issued AS (
    SELECT mii.item_id,
           SUM(mii.quantity_issued)::numeric AS qty_issued,
           MAX(mii.unit_cost)::numeric       AS unit_cost,
           MAX(NULLIF(mii.unit_of_measure, '')) AS uom
    FROM public.material_issue_items mii
    WHERE mii.min_id = p_min_id
    GROUP BY mii.item_id
  ),
  returned AS (
    SELECT mri.item_id,
           SUM(mri.quantity_returned)::numeric AS qty_returned
    FROM public.material_return_items mri
    JOIN public.material_return_notes mrn ON mrn.id = mri.mrn_id
    WHERE mrn.reference_type = 'material_issue'
      AND mrn.reference_id   = p_min_id
    GROUP BY mri.item_id
  )
  SELECT i.item_id,
         COALESCE(NULLIF(wif.item_code, ''), 'ITEM-' || substring(i.item_id::text, 1, 8)) AS item_code,
         COALESCE(NULLIF(wif.name, ''), '(Unnamed item)') AS item_name,
         COALESCE(i.uom, NULLIF(wif.unit_of_measure, ''), 'EA') AS unit_of_measure,
         i.qty_issued,
         COALESCE(r.qty_returned, 0) AS qty_returned_prev,
         GREATEST(i.qty_issued - COALESCE(r.qty_returned, 0), 0) AS remaining,
         COALESCE(i.unit_cost, wif.unit_cost, 0) AS unit_cost
  FROM issued i
  LEFT JOIN returned r ON r.item_id = i.item_id
  LEFT JOIN public.warehouse_items_full wif ON wif.id = i.item_id
  ORDER BY 2 NULLS LAST;
END;
$function$;