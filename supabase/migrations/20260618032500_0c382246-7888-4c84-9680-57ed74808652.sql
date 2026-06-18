
-- Lists candidate source MRNs that can be used to clone items into an empty target MRN
CREATE OR REPLACE FUNCTION public.list_repair_candidate_mrns(
  p_target_mrn_id uuid,
  p_search text DEFAULT NULL,
  p_limit integer DEFAULT 25
)
RETURNS TABLE (
  id uuid,
  mrn_number text,
  return_date date,
  returned_by text,
  notes text,
  status text,
  item_count bigint,
  total_value numeric
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_company_id uuid;
  v_search text := NULLIF(btrim(COALESCE(p_search, '')), '');
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE = '28000';
  END IF;

  SELECT company_id INTO v_company_id
  FROM public.material_return_notes
  WHERE id = p_target_mrn_id;

  IF v_company_id IS NULL THEN
    RAISE EXCEPTION 'Target MRN not found or has no company' USING ERRCODE = 'P0002';
  END IF;

  IF NOT public.can_access_company(v_company_id) THEN
    RAISE EXCEPTION 'You do not have access to this company' USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  SELECT
    mrn.id,
    mrn.mrn_number::text,
    mrn.return_date,
    mrn.returned_by::text,
    mrn.notes::text,
    mrn.status::text,
    COUNT(mri.id) AS item_count,
    COALESCE(mrn.total_value, 0) AS total_value
  FROM public.material_return_notes mrn
  JOIN public.material_return_items mri ON mri.mrn_id = mrn.id
  WHERE mrn.company_id = v_company_id
    AND mrn.id <> p_target_mrn_id
    AND (
      v_search IS NULL
      OR mrn.mrn_number ILIKE '%' || v_search || '%'
      OR COALESCE(mrn.notes, '') ILIKE '%' || v_search || '%'
      OR COALESCE(mrn.returned_by, '') ILIKE '%' || v_search || '%'
    )
  GROUP BY mrn.id
  HAVING COUNT(mri.id) > 0
  ORDER BY mrn.return_date DESC, mrn.created_at DESC
  LIMIT GREATEST(1, LEAST(COALESCE(p_limit, 25), 200));
END;
$$;

GRANT EXECUTE ON FUNCTION public.list_repair_candidate_mrns(uuid, text, integer) TO authenticated;

-- Clones the line items from p_source_mrn_id into the empty p_target_mrn_id,
-- optionally applying per-line overrides (quantity_returned, condition, notes).
-- Delegates persistence + stock posting to add_missing_material_return_items so
-- there is exactly one code path that ever writes material_return_items rows.
CREATE OR REPLACE FUNCTION public.repair_material_return_from_reference(
  p_target_mrn_id uuid,
  p_source_mrn_id uuid,
  p_overrides jsonb DEFAULT '[]'::jsonb
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_target public.material_return_notes%ROWTYPE;
  v_source public.material_return_notes%ROWTYPE;
  v_items jsonb;
  v_inserted integer;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE = '28000';
  END IF;

  IF p_target_mrn_id = p_source_mrn_id THEN
    RAISE EXCEPTION 'Source and target MRN cannot be the same' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO v_target FROM public.material_return_notes WHERE id = p_target_mrn_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Target MRN not found' USING ERRCODE = 'P0002';
  END IF;

  SELECT * INTO v_source FROM public.material_return_notes WHERE id = p_source_mrn_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Source MRN not found' USING ERRCODE = 'P0002';
  END IF;

  IF v_target.company_id IS NULL OR v_target.company_id IS DISTINCT FROM v_source.company_id THEN
    RAISE EXCEPTION 'Source and target MRN must belong to the same company' USING ERRCODE = '42501';
  END IF;

  IF NOT public.can_access_company(v_target.company_id) THEN
    RAISE EXCEPTION 'You do not have access to this company' USING ERRCODE = '42501';
  END IF;

  IF EXISTS (SELECT 1 FROM public.material_return_items WHERE mrn_id = p_target_mrn_id) THEN
    RAISE EXCEPTION 'Target MRN already has item lines' USING ERRCODE = '23505';
  END IF;

  -- Build items payload from source items, applying any per-line overrides
  -- keyed by source item_id.
  WITH src AS (
    SELECT
      mri.item_id,
      mri.quantity_returned,
      mri.unit_cost,
      mri.total_cost,
      mri.condition::text AS condition,
      mri.notes,
      mri.secondary_quantity_returned,
      mri.secondary_uom
    FROM public.material_return_items mri
    WHERE mri.mrn_id = p_source_mrn_id
  ),
  ov AS (
    SELECT
      (o->>'item_id')::uuid AS item_id,
      NULLIF(o->>'quantity_returned', '')::numeric AS quantity_returned,
      NULLIF(o->>'condition', '') AS condition,
      NULLIF(o->>'notes', '') AS notes
    FROM jsonb_array_elements(COALESCE(p_overrides, '[]'::jsonb)) AS o
  ),
  merged AS (
    SELECT
      src.item_id,
      COALESCE(ov.quantity_returned, src.quantity_returned) AS quantity_returned,
      COALESCE(src.unit_cost, 0) AS unit_cost,
      COALESCE(ov.condition, src.condition, 'good') AS condition,
      COALESCE(ov.notes, src.notes) AS notes,
      src.secondary_quantity_returned,
      src.secondary_uom
    FROM src
    LEFT JOIN ov ON ov.item_id = src.item_id
  )
  SELECT COALESCE(jsonb_agg(
    jsonb_strip_nulls(jsonb_build_object(
      'item_id', item_id,
      'quantity_returned', quantity_returned,
      'unit_cost', unit_cost,
      'total_cost', quantity_returned * unit_cost,
      'condition', condition,
      'notes', notes,
      'secondary_quantity_returned', secondary_quantity_returned,
      'secondary_uom', secondary_uom
    ))
  ), '[]'::jsonb)
  INTO v_items
  FROM merged
  WHERE quantity_returned > 0;

  IF v_items IS NULL OR jsonb_array_length(v_items) = 0 THEN
    RAISE EXCEPTION 'Source MRN has no usable items' USING ERRCODE = '23514';
  END IF;

  v_inserted := public.add_missing_material_return_items(p_target_mrn_id, v_items);
  RETURN v_inserted;
END;
$$;

GRANT EXECUTE ON FUNCTION public.repair_material_return_from_reference(uuid, uuid, jsonb) TO authenticated;
