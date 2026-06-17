CREATE OR REPLACE FUNCTION public.add_missing_material_return_items(
  p_mrn_id uuid,
  p_items jsonb DEFAULT '[]'::jsonb
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_mrn public.material_return_notes%ROWTYPE;
  v_item_count integer;
  v_invalid_count integer;
  v_inserted_count integer := 0;
  v_payload jsonb;
  v_bin_allocation_id uuid;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'User must be authenticated to repair material return items'
      USING ERRCODE = '28000';
  END IF;

  IF NOT public.is_admin(v_user_id) THEN
    RAISE EXCEPTION 'Only admins can repair missing material return items'
      USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_mrn
  FROM public.material_return_notes
  WHERE id = p_mrn_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Material return note not found: %', p_mrn_id
      USING ERRCODE = 'P0002';
  END IF;

  IF v_mrn.company_id IS NULL THEN
    RAISE EXCEPTION 'Material return note company is required'
      USING ERRCODE = '23502';
  END IF;

  IF NOT public.can_access_company(v_mrn.company_id) THEN
    RAISE EXCEPTION 'You do not have access to this company'
      USING ERRCODE = '42501';
  END IF;

  IF EXISTS (SELECT 1 FROM public.material_return_items WHERE mrn_id = p_mrn_id) THEN
    RAISE EXCEPTION 'This material return note already has item lines'
      USING ERRCODE = '23505';
  END IF;

  IF v_mrn.status NOT IN ('draft', 'returned') THEN
    RAISE EXCEPTION 'Missing items can only be repaired for draft or returned MRNs'
      USING ERRCODE = '22023';
  END IF;

  WITH parsed AS (
    SELECT
      NULLIF(item_payload->>'item_id', '')::uuid AS item_id,
      COALESCE(NULLIF(item_payload->>'quantity_returned', '')::numeric, 0) AS quantity_returned,
      COALESCE(NULLIF(item_payload->>'condition', ''), 'good') AS condition
    FROM jsonb_array_elements(COALESCE(p_items, '[]'::jsonb)) AS item_payload
  )
  SELECT COUNT(*) INTO v_item_count
  FROM parsed
  WHERE item_id IS NOT NULL
    AND quantity_returned > 0
    AND condition IN ('good', 'damaged', 'expired');

  IF v_item_count = 0 THEN
    RAISE EXCEPTION 'At least one valid return item is required'
      USING ERRCODE = '23514';
  END IF;

  WITH parsed AS (
    SELECT
      NULLIF(item_payload->>'item_id', '')::uuid AS item_id,
      COALESCE(NULLIF(item_payload->>'quantity_returned', '')::numeric, 0) AS quantity_returned,
      COALESCE(NULLIF(item_payload->>'condition', ''), 'good') AS condition
    FROM jsonb_array_elements(COALESCE(p_items, '[]'::jsonb)) AS item_payload
  )
  SELECT COUNT(*) INTO v_invalid_count
  FROM parsed p
  LEFT JOIN public.warehouse_items wi ON wi.id = p.item_id
  WHERE p.item_id IS NULL
     OR p.quantity_returned <= 0
     OR p.condition NOT IN ('good', 'damaged', 'expired')
     OR wi.id IS NULL
     OR wi.company_id IS DISTINCT FROM v_mrn.company_id;

  IF v_invalid_count > 0 THEN
    RAISE EXCEPTION 'One or more return items are invalid for this MRN company'
      USING ERRCODE = '23514';
  END IF;

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
    p_mrn_id,
    (item_payload->>'item_id')::uuid,
    (item_payload->>'quantity_returned')::numeric,
    COALESCE(NULLIF(item_payload->>'unit_cost', '')::numeric, 0),
    COALESCE(
      NULLIF(item_payload->>'total_cost', '')::numeric,
      (item_payload->>'quantity_returned')::numeric * COALESCE(NULLIF(item_payload->>'unit_cost', '')::numeric, 0)
    ),
    COALESCE(NULLIF(item_payload->>'condition', ''), 'good'),
    NULLIF(btrim(COALESCE(item_payload->>'notes', '')), ''),
    NULLIF(item_payload->>'secondary_quantity_returned', '')::numeric,
    NULLIF(btrim(COALESCE(item_payload->>'secondary_uom', '')), '')
  FROM jsonb_array_elements(COALESCE(p_items, '[]'::jsonb)) AS item_payload
  WHERE (item_payload->>'quantity_returned')::numeric > 0;

  GET DIAGNOSTICS v_inserted_count = ROW_COUNT;

  UPDATE public.material_return_notes
  SET total_value = (
        SELECT COALESCE(SUM(total_cost), 0)
        FROM public.material_return_items
        WHERE mrn_id = p_mrn_id
      ),
      updated_at = now()
  WHERE id = p_mrn_id;

  IF v_mrn.status = 'returned' THEN
    FOR v_payload IN
      SELECT item_payload
      FROM jsonb_array_elements(COALESCE(p_items, '[]'::jsonb)) AS item_payload
      WHERE (item_payload->>'quantity_returned')::numeric > 0
    LOOP
      SELECT id INTO v_bin_allocation_id
      FROM public.warehouse_bin_allocations
      WHERE warehouse_item_id = (v_payload->>'item_id')::uuid
        AND company_id = v_mrn.company_id
      LIMIT 1;

      PERFORM public.process_material_return_stock_update(
        (v_payload->>'item_id')::uuid,
        (v_payload->>'quantity_returned')::numeric,
        v_bin_allocation_id,
        p_mrn_id,
        v_mrn.mrn_number,
        v_mrn.company_id,
        NULLIF(v_payload->>'secondary_quantity_returned', '')::numeric
      );
    END LOOP;
  END IF;

  RETURN v_inserted_count;
END;
$$;

REVOKE ALL ON FUNCTION public.add_missing_material_return_items(uuid, jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.add_missing_material_return_items(uuid, jsonb) FROM anon;
GRANT EXECUTE ON FUNCTION public.add_missing_material_return_items(uuid, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.add_missing_material_return_items(uuid, jsonb) TO service_role;