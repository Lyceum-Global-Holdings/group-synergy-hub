CREATE OR REPLACE FUNCTION public.get_min_returnable_lines(p_min_id uuid)
RETURNS TABLE(
  item_id uuid,
  item_code text,
  item_name text,
  unit_of_measure text,
  qty_issued numeric,
  qty_returned_prev numeric,
  remaining numeric,
  unit_cost numeric
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_company uuid;
BEGIN
  SELECT min_note.company_id
    INTO v_company
  FROM public.material_issue_notes AS min_note
  WHERE min_note.id = p_min_id;

  IF v_company IS NULL OR NOT public.can_access_company(v_company) THEN
    RETURN;
  END IF;

  RETURN QUERY
  WITH issued AS (
    SELECT
      mii.item_id,
      SUM(COALESCE(mii.quantity_issued, 0))::numeric AS qty_issued,
      MAX(mii.unit_cost)::numeric AS unit_cost,
      MAX(NULLIF(BTRIM(mii.unit_of_measure), ''))::text AS issued_uom,
      MAX(NULLIF(BTRIM(mii.item_code), ''))::text AS issued_item_code,
      MAX(NULLIF(BTRIM(mii.description), ''))::text AS issued_description
    FROM public.material_issue_items AS mii
    WHERE mii.min_id = p_min_id
      AND mii.item_id IS NOT NULL
    GROUP BY mii.item_id
  ),
  returned AS (
    SELECT
      mri.item_id,
      SUM(COALESCE(mri.quantity_returned, 0))::numeric AS qty_returned
    FROM public.material_return_items AS mri
    JOIN public.material_return_notes AS mrn
      ON mrn.id = mri.mrn_id
    WHERE mrn.reference_type = 'material_issue'
      AND mrn.reference_id = p_min_id
      AND mri.item_id IS NOT NULL
    GROUP BY mri.item_id
  )
  SELECT
    i.item_id,
    COALESCE(
      i.issued_item_code,
      NULLIF(BTRIM(wif.item_code), ''),
      'ITEM-' || SUBSTRING(i.item_id::text, 1, 8)
    ) AS item_code,
    COALESCE(
      NULLIF(BTRIM(wif.name), ''),
      i.issued_description,
      '(Unnamed item)'
    ) AS item_name,
    COALESCE(
      i.issued_uom,
      NULLIF(BTRIM(wif.base_uom), ''),
      NULLIF(BTRIM(iu.abbreviation), ''),
      NULLIF(BTRIM(iu.name), ''),
      NULLIF(BTRIM(wif.secondary_uom), ''),
      'EA'
    ) AS unit_of_measure,
    i.qty_issued,
    COALESCE(r.qty_returned, 0)::numeric AS qty_returned_prev,
    GREATEST(i.qty_issued - COALESCE(r.qty_returned, 0), 0)::numeric AS remaining,
    COALESCE(i.unit_cost, wif.unit_cost, 0)::numeric AS unit_cost
  FROM issued AS i
  LEFT JOIN returned AS r
    ON r.item_id = i.item_id
  LEFT JOIN public.warehouse_items_full AS wif
    ON wif.id = i.item_id
  LEFT JOIN public.item_units AS iu
    ON iu.id = wif.unit_id
  WHERE GREATEST(i.qty_issued - COALESCE(r.qty_returned, 0), 0) > 0
  ORDER BY item_code;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.get_min_returnable_lines(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_min_returnable_lines(uuid) TO service_role;