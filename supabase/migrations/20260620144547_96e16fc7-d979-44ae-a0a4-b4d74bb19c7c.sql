
-- 1. Add bin_id to material_return_items (nullable for back-compat with legacy rows)
ALTER TABLE public.material_return_items
  ADD COLUMN IF NOT EXISTS bin_id uuid REFERENCES public.warehouse_bins(id);

CREATE INDEX IF NOT EXISTS idx_material_return_items_bin_id
  ON public.material_return_items(bin_id);

-- 2. RPC: where was this MIN line issued from? Used to pre-fill the return-to-bin selector.
CREATE OR REPLACE FUNCTION public.get_min_issued_bins(
  p_min_id uuid,
  p_item_id uuid
)
RETURNS TABLE(
  bin_id uuid,
  bin_code text,
  location_id uuid,
  quantity numeric
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_company_id uuid;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE = '28000';
  END IF;

  SELECT company_id INTO v_company_id
  FROM public.material_issue_notes WHERE id = p_min_id;

  IF v_company_id IS NULL OR NOT public.can_access_company(v_company_id) THEN
    RAISE EXCEPTION 'You do not have access to this MIN' USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  SELECT
    st.bin_id,
    wb.bin_code,
    wb.location_id,
    SUM(ABS(st.quantity_change))::numeric AS quantity
  FROM public.stock_transactions st
  JOIN public.warehouse_bins wb ON wb.id = st.bin_id
  WHERE st.reference_type = 'min'
    AND st.reference_id = p_min_id
    AND st.item_id = p_item_id
    AND st.bin_id IS NOT NULL
    AND st.quantity_change < 0
  GROUP BY st.bin_id, wb.bin_code, wb.location_id
  ORDER BY quantity DESC;
END;
$$;

REVOKE ALL ON FUNCTION public.get_min_issued_bins(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_min_issued_bins(uuid, uuid) TO authenticated, service_role;

-- 3. get_material_return_items: expose bin_id + bin_code
DROP FUNCTION IF EXISTS public.get_material_return_items(uuid);

CREATE OR REPLACE FUNCTION public.get_material_return_items(p_mrn_id uuid)
RETURNS TABLE(
  id uuid,
  mrn_id uuid,
  item_id uuid,
  quantity_returned numeric,
  unit_cost numeric,
  total_cost numeric,
  condition text,
  notes text,
  created_at timestamptz,
  updated_at timestamptz,
  secondary_quantity_returned numeric,
  secondary_uom text,
  item_code text,
  item_name text,
  unit_of_measure text,
  bin_id uuid,
  bin_code text
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_company_id uuid;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'User must be authenticated to view material return items' USING ERRCODE = '28000';
  END IF;

  SELECT mrn.company_id INTO v_company_id
  FROM public.material_return_notes mrn
  WHERE mrn.id = p_mrn_id;

  IF v_company_id IS NULL OR NOT public.can_access_company(v_company_id) THEN
    RAISE EXCEPTION 'You do not have access to this material return note' USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  SELECT
    mri.id,
    mri.mrn_id,
    mri.item_id,
    mri.quantity_returned,
    mri.unit_cost,
    mri.total_cost,
    mri.condition,
    mri.notes,
    mri.created_at,
    mri.updated_at,
    mri.secondary_quantity_returned,
    mri.secondary_uom,
    COALESCE(NULLIF(BTRIM(wif.item_code), ''), 'ITEM-' || SUBSTRING(mri.item_id::text, 1, 8)) AS item_code,
    COALESCE(NULLIF(BTRIM(wif.name), ''), '(Unnamed item)') AS item_name,
    COALESCE(NULLIF(BTRIM(wif.base_uom), ''), NULLIF(BTRIM(wif.secondary_uom), ''), 'EA') AS unit_of_measure,
    mri.bin_id,
    wb.bin_code
  FROM public.material_return_items mri
  LEFT JOIN public.warehouse_items_full wif ON wif.id = mri.item_id
  LEFT JOIN public.warehouse_bins wb ON wb.id = mri.bin_id
  WHERE mri.mrn_id = p_mrn_id
  ORDER BY mri.created_at, mri.id;
END;
$$;

REVOKE ALL ON FUNCTION public.get_material_return_items(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_material_return_items(uuid) TO authenticated, service_role;

-- 4. create_material_return_with_items: persist bin_id per line
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
  p_items jsonb DEFAULT '[]'::jsonb,
  p_location_id uuid DEFAULT NULL
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
  v_inserted_count integer := 0;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'User must be authenticated to create a material return note' USING ERRCODE = '28000';
  END IF;

  IF p_company_id IS NULL THEN
    RAISE EXCEPTION 'Company is required for material return notes' USING ERRCODE = '23502';
  END IF;

  IF NOT public.can_access_company(p_company_id) THEN
    RAISE EXCEPTION 'You do not have access to this company' USING ERRCODE = '42501';
  END IF;

  IF NULLIF(btrim(p_returned_by), '') IS NULL THEN
    RAISE EXCEPTION 'Returned by is required' USING ERRCODE = '23502';
  END IF;

  IF NULLIF(btrim(p_reason), '') IS NULL THEN
    RAISE EXCEPTION 'Reason is required' USING ERRCODE = '23502';
  END IF;

  IF p_return_type NOT IN ('internal', 'supplier') THEN
    RAISE EXCEPTION 'Invalid return type: %', p_return_type USING ERRCODE = '22023';
  END IF;

  IF p_reference_type IS NOT NULL AND p_reference_type NOT IN ('material_issue', 'purchase_order', 'other') THEN
    RAISE EXCEPTION 'Invalid reference type: %', p_reference_type USING ERRCODE = '22023';
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
    RAISE EXCEPTION 'At least one return item with a quantity greater than zero is required' USING ERRCODE = '23514';
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
  LEFT JOIN public.warehouse_items_full wif
    ON wif.id = p.item_id AND wif.company_id = p_company_id
  WHERE p.item_id IS NULL
     OR p.quantity_returned <= 0
     OR p.condition NOT IN ('good', 'damaged', 'expired')
     OR wif.id IS NULL;

  IF v_invalid_count > 0 THEN
    RAISE EXCEPTION 'One or more return items are invalid for the selected company' USING ERRCODE = '23514';
  END IF;

  SELECT COALESCE(SUM(
    COALESCE(NULLIF(item_payload->>'quantity_returned', '')::numeric, 0)
    * COALESCE(NULLIF(item_payload->>'unit_cost', '')::numeric, 0)
  ), 0)
  INTO v_total_value
  FROM jsonb_array_elements(COALESCE(p_items, '[]'::jsonb)) AS item_payload;

  SELECT public.generate_mrn_number() INTO v_mrn_number;

  INSERT INTO public.material_return_notes (
    mrn_number, return_date, returned_by, return_type, reason,
    reference_type, reference_id, status, total_value, notes,
    company_id, created_by, srn_number, location_id
  ) VALUES (
    v_mrn_number, p_return_date, btrim(p_returned_by), p_return_type, btrim(p_reason),
    p_reference_type, p_reference_id, 'draft', v_total_value,
    NULLIF(btrim(COALESCE(p_notes, '')), ''),
    p_company_id, v_user_id,
    NULLIF(btrim(COALESCE(p_srn_number, '')), ''),
    p_location_id
  )
  RETURNING * INTO v_return_note;

  INSERT INTO public.material_return_items (
    mrn_id, item_id, quantity_returned, unit_cost, total_cost,
    condition, notes, secondary_quantity_returned, secondary_uom, bin_id
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
    NULLIF(btrim(COALESCE(item_payload->>'secondary_uom', '')), ''),
    NULLIF(item_payload->>'bin_id', '')::uuid
  FROM jsonb_array_elements(COALESCE(p_items, '[]'::jsonb)) AS item_payload
  WHERE NULLIF(item_payload->>'item_id', '') IS NOT NULL
    AND COALESCE(NULLIF(item_payload->>'quantity_returned', '')::numeric, 0) > 0;

  GET DIAGNOSTICS v_inserted_count = ROW_COUNT;

  IF v_inserted_count <> v_item_count THEN
    RAISE EXCEPTION 'Failed to persist all material return items — aborting to prevent an incomplete draft' USING ERRCODE = '23514';
  END IF;

  RETURN v_return_note;
END;
$$;

REVOKE ALL ON FUNCTION public.create_material_return_with_items(date, text, text, text, text, uuid, text, uuid, text, jsonb, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_material_return_with_items(date, text, text, text, text, uuid, text, uuid, text, jsonb, uuid) TO authenticated, service_role;

-- 5. approve_material_return: post stock back to the chosen bin per line.
--    Reject approval if any returnable line is missing a bin (ISO 9001 §8.5.4 traceability,
--    SAP EWM mvt 653/655 — return stock must be addressed at an exact bin).
CREATE OR REPLACE FUNCTION public.approve_material_return(p_mrn_id uuid)
RETURNS public.material_return_notes
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_mrn public.material_return_notes%ROWTYPE;
  v_item record;
  v_bin_allocation_id uuid;
  v_updated public.material_return_notes;
  v_missing_bin integer;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'User must be authenticated to approve material returns' USING ERRCODE = '28000';
  END IF;

  IF NOT public.is_admin(v_user_id) THEN
    RAISE EXCEPTION 'Only admins can approve material returns' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_mrn
  FROM public.material_return_notes WHERE id = p_mrn_id FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Material return note not found: %', p_mrn_id USING ERRCODE = 'P0002';
  END IF;

  IF v_mrn.status = 'cancelled' THEN
    RAISE EXCEPTION 'Cancelled material return notes cannot be approved' USING ERRCODE = '22023';
  END IF;

  IF v_mrn.status = 'returned' THEN
    RETURN v_mrn;
  END IF;

  IF v_mrn.company_id IS NULL OR NOT public.can_access_company(v_mrn.company_id) THEN
    RAISE EXCEPTION 'You do not have access to this material return note' USING ERRCODE = '42501';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.material_return_items WHERE mrn_id = p_mrn_id) THEN
    RAISE EXCEPTION 'Cannot approve material return note without return items' USING ERRCODE = '23514';
  END IF;

  -- Guard: every returnable line must have a destination bin
  SELECT COUNT(*) INTO v_missing_bin
  FROM public.material_return_items
  WHERE mrn_id = p_mrn_id
    AND quantity_returned > 0
    AND bin_id IS NULL;

  IF v_missing_bin > 0 THEN
    RAISE EXCEPTION 'Cannot approve: % return line(s) have no destination bin selected. Edit the draft and pick a bin for each item (ISO 9001 §8.5.4).', v_missing_bin
      USING ERRCODE = '23514';
  END IF;

  FOR v_item IN
    SELECT * FROM public.material_return_items WHERE mrn_id = p_mrn_id ORDER BY created_at, id
  LOOP
    -- Find-or-create the bin allocation row for this (item, bin, company)
    INSERT INTO public.warehouse_bin_allocations (warehouse_item_id, bin_id, company_id, allocated_quantity)
    VALUES (v_item.item_id, v_item.bin_id, v_mrn.company_id, 0)
    ON CONFLICT (warehouse_item_id, bin_id) DO NOTHING;

    SELECT id INTO v_bin_allocation_id
    FROM public.warehouse_bin_allocations
    WHERE warehouse_item_id = v_item.item_id
      AND bin_id = v_item.bin_id
    LIMIT 1;

    PERFORM public.process_material_return_stock_update(
      v_item.item_id,
      v_item.quantity_returned,
      v_bin_allocation_id,
      p_mrn_id,
      v_mrn.mrn_number,
      v_mrn.company_id,
      v_item.secondary_quantity_returned
    );
  END LOOP;

  UPDATE public.material_return_notes
  SET status = 'returned',
      approved_by = v_user_id,
      approved_date = now(),
      total_value = (
        SELECT COALESCE(SUM(total_cost), 0)
        FROM public.material_return_items
        WHERE mrn_id = p_mrn_id
      ),
      updated_at = now()
  WHERE id = p_mrn_id
  RETURNING * INTO v_updated;

  RETURN v_updated;
END;
$$;

REVOKE ALL ON FUNCTION public.approve_material_return(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.approve_material_return(uuid) TO authenticated, service_role;
