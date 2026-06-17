CREATE OR REPLACE FUNCTION public.create_material_return_with_items(
  p_return_date date,
  p_returned_by text,
  p_return_type text,
  p_reason text,
  p_reference_type text DEFAULT NULL,
  p_reference_id uuid DEFAULT NULL,
  p_notes text DEFAULT NULL,
  p_company_id uuid DEFAULT NULL,
  p_srn_number text DEFAULT NULL,
  p_items jsonb DEFAULT '[]'::jsonb
)
RETURNS public.material_return_notes
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_mrn_number text;
  v_return_note public.material_return_notes;
  v_item_count integer;
  v_invalid_count integer;
  v_total_value numeric := 0;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'User must be authenticated to create a material return note'
      USING ERRCODE = '28000';
  END IF;

  IF p_company_id IS NULL THEN
    RAISE EXCEPTION 'Company is required for material return notes'
      USING ERRCODE = '23502';
  END IF;

  IF NOT public.can_access_company(p_company_id) THEN
    RAISE EXCEPTION 'You do not have access to this company'
      USING ERRCODE = '42501';
  END IF;

  IF NULLIF(btrim(p_returned_by), '') IS NULL THEN
    RAISE EXCEPTION 'Returned by is required'
      USING ERRCODE = '23502';
  END IF;

  IF NULLIF(btrim(p_reason), '') IS NULL THEN
    RAISE EXCEPTION 'Reason is required'
      USING ERRCODE = '23502';
  END IF;

  IF p_return_type NOT IN ('internal', 'supplier') THEN
    RAISE EXCEPTION 'Invalid return type: %', p_return_type
      USING ERRCODE = '22023';
  END IF;

  IF p_reference_type IS NOT NULL AND p_reference_type NOT IN ('material_issue', 'purchase_order', 'other') THEN
    RAISE EXCEPTION 'Invalid reference type: %', p_reference_type
      USING ERRCODE = '22023';
  END IF;

  WITH parsed AS (
    SELECT
      NULLIF(item_payload->>'item_id', '')::uuid AS item_id,
      COALESCE(NULLIF(item_payload->>'quantity_returned', '')::numeric, 0) AS quantity_returned,
      COALESCE(NULLIF(item_payload->>'unit_cost', '')::numeric, 0) AS unit_cost,
      COALESCE(NULLIF(item_payload->>'condition', ''), 'good') AS condition
    FROM jsonb_array_elements(COALESCE(p_items, '[]'::jsonb)) AS item_payload
  )
  SELECT COUNT(*)
    INTO v_item_count
  FROM parsed
  WHERE item_id IS NOT NULL
    AND quantity_returned > 0
    AND condition IN ('good', 'damaged', 'expired');

  IF v_item_count = 0 THEN
    RAISE EXCEPTION 'At least one return item with a quantity greater than zero is required'
      USING ERRCODE = '23514';
  END IF;

  WITH parsed AS (
    SELECT
      NULLIF(item_payload->>'item_id', '')::uuid AS item_id,
      COALESCE(NULLIF(item_payload->>'quantity_returned', '')::numeric, 0) AS quantity_returned,
      COALESCE(NULLIF(item_payload->>'condition', ''), 'good') AS condition
    FROM jsonb_array_elements(COALESCE(p_items, '[]'::jsonb)) AS item_payload
  )
  SELECT COUNT(*)
    INTO v_invalid_count
  FROM parsed p
  LEFT JOIN public.warehouse_items wi ON wi.id = p.item_id
  WHERE p.item_id IS NULL
     OR p.quantity_returned <= 0
     OR p.condition NOT IN ('good', 'damaged', 'expired')
     OR wi.id IS NULL
     OR wi.company_id IS DISTINCT FROM p_company_id;

  IF v_invalid_count > 0 THEN
    RAISE EXCEPTION 'One or more return items are invalid for the selected company'
      USING ERRCODE = '23514';
  END IF;

  SELECT COALESCE(SUM(
    COALESCE(NULLIF(item_payload->>'quantity_returned', '')::numeric, 0)
    * COALESCE(NULLIF(item_payload->>'unit_cost', '')::numeric, 0)
  ), 0)
    INTO v_total_value
  FROM jsonb_array_elements(COALESCE(p_items, '[]'::jsonb)) AS item_payload;

  SELECT public.generate_mrn_number() INTO v_mrn_number;

  INSERT INTO public.material_return_notes (
    mrn_number,
    return_date,
    returned_by,
    return_type,
    reason,
    reference_type,
    reference_id,
    status,
    total_value,
    notes,
    company_id,
    created_by,
    srn_number
  ) VALUES (
    v_mrn_number,
    p_return_date,
    btrim(p_returned_by),
    p_return_type,
    btrim(p_reason),
    p_reference_type,
    p_reference_id,
    'draft',
    v_total_value,
    NULLIF(btrim(COALESCE(p_notes, '')), ''),
    p_company_id,
    v_user_id,
    NULLIF(btrim(COALESCE(p_srn_number, '')), '')
  )
  RETURNING * INTO v_return_note;

  INSERT INTO public.material_return_items (
    mrn_id,
    item_id,
    quantity_returned,
    unit_cost,
    total_cost,
    condition,
    notes,
    secondary_quantity_returned,
    secondary_uom
  )
  SELECT
    v_return_note.id,
    (item_payload->>'item_id')::uuid,
    (item_payload->>'quantity_returned')::numeric,
    COALESCE(NULLIF(item_payload->>'unit_cost', '')::numeric, 0),
    COALESCE(NULLIF(item_payload->>'total_cost', '')::numeric,
      (item_payload->>'quantity_returned')::numeric * COALESCE(NULLIF(item_payload->>'unit_cost', '')::numeric, 0)
    ),
    COALESCE(NULLIF(item_payload->>'condition', ''), 'good'),
    NULLIF(btrim(COALESCE(item_payload->>'notes', '')), ''),
    NULLIF(item_payload->>'secondary_quantity_returned', '')::numeric,
    NULLIF(btrim(COALESCE(item_payload->>'secondary_uom', '')), '')
  FROM jsonb_array_elements(COALESCE(p_items, '[]'::jsonb)) AS item_payload
  WHERE (item_payload->>'quantity_returned')::numeric > 0;

  RETURN v_return_note;
END;
$$;

REVOKE ALL ON FUNCTION public.create_material_return_with_items(date, text, text, text, text, uuid, text, uuid, text, jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.create_material_return_with_items(date, text, text, text, text, uuid, text, uuid, text, jsonb) FROM anon;
GRANT EXECUTE ON FUNCTION public.create_material_return_with_items(date, text, text, text, text, uuid, text, uuid, text, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_material_return_with_items(date, text, text, text, text, uuid, text, uuid, text, jsonb) TO service_role;