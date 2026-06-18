-- Ensure material return item visibility is company-scoped and not blocked by stale policies.
DROP POLICY IF EXISTS "Users can manage items for their own material returns" ON public.material_return_items;
DROP POLICY IF EXISTS "Users can view material return items they have access to" ON public.material_return_items;
DROP POLICY IF EXISTS "Authenticated users can add material return items" ON public.material_return_items;
DROP POLICY IF EXISTS "Authenticated users can update material return items" ON public.material_return_items;
DROP POLICY IF EXISTS "Authenticated users can delete material return items" ON public.material_return_items;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.material_return_items TO authenticated;
GRANT ALL ON public.material_return_items TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.material_return_notes TO authenticated;
GRANT ALL ON public.material_return_notes TO service_role;

CREATE POLICY "Users can view material return items for accessible companies"
ON public.material_return_items
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.material_return_notes mrn
    WHERE mrn.id = material_return_items.mrn_id
      AND public.can_access_company(mrn.company_id)
  )
);

CREATE POLICY "Users can add draft material return items for accessible companies"
ON public.material_return_items
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.material_return_notes mrn
    WHERE mrn.id = material_return_items.mrn_id
      AND mrn.status = 'draft'
      AND public.can_access_company(mrn.company_id)
  )
);

CREATE POLICY "Users can update draft material return items for accessible companies"
ON public.material_return_items
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.material_return_notes mrn
    WHERE mrn.id = material_return_items.mrn_id
      AND mrn.status = 'draft'
      AND public.can_access_company(mrn.company_id)
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.material_return_notes mrn
    WHERE mrn.id = material_return_items.mrn_id
      AND mrn.status = 'draft'
      AND public.can_access_company(mrn.company_id)
  )
);

CREATE POLICY "Users can delete draft material return items for accessible companies"
ON public.material_return_items
FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.material_return_notes mrn
    WHERE mrn.id = material_return_items.mrn_id
      AND mrn.status = 'draft'
      AND public.can_access_company(mrn.company_id)
  )
);

-- Return item reader: bypass join/RLS edge cases but keep explicit company access.
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
  unit_of_measure text
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
    RAISE EXCEPTION 'User must be authenticated to view material return items'
      USING ERRCODE = '28000';
  END IF;

  SELECT mrn.company_id
    INTO v_company_id
  FROM public.material_return_notes mrn
  WHERE mrn.id = p_mrn_id;

  IF v_company_id IS NULL OR NOT public.can_access_company(v_company_id) THEN
    RAISE EXCEPTION 'You do not have access to this material return note'
      USING ERRCODE = '42501';
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
    COALESCE(NULLIF(BTRIM(wif.base_uom), ''), NULLIF(BTRIM(wif.secondary_uom), ''), 'EA') AS unit_of_measure
  FROM public.material_return_items mri
  LEFT JOIN public.warehouse_items_full wif
    ON wif.id = mri.item_id
  WHERE mri.mrn_id = p_mrn_id
  ORDER BY mri.created_at, mri.id;
END;
$$;

REVOKE ALL ON FUNCTION public.get_material_return_items(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_material_return_items(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.get_material_return_items(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_material_return_items(uuid) TO service_role;

-- Atomic MRN creation: validate against warehouse_items_full (catalog source of truth) and abort if lines are not saved.
CREATE OR REPLACE FUNCTION public.create_material_return_with_items(
  p_return_date date,
  p_returned_by text,
  p_return_type text,
  p_reason text,
  p_reference_type text DEFAULT NULL::text,
  p_reference_id uuid DEFAULT NULL::uuid,
  p_notes text DEFAULT NULL::text,
  p_company_id uuid DEFAULT NULL::uuid,
  p_srn_number text DEFAULT NULL::text,
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
    ON wif.id = p.item_id
   AND wif.company_id = p_company_id
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
    company_id, created_by, srn_number
  ) VALUES (
    v_mrn_number, p_return_date, btrim(p_returned_by), p_return_type, btrim(p_reason),
    p_reference_type, p_reference_id, 'draft', v_total_value,
    NULLIF(btrim(COALESCE(p_notes, '')), ''),
    p_company_id, v_user_id,
    NULLIF(btrim(COALESCE(p_srn_number, '')), '')
  )
  RETURNING * INTO v_return_note;

  INSERT INTO public.material_return_items (
    mrn_id, item_id, quantity_returned, unit_cost, total_cost,
    condition, notes, secondary_quantity_returned, secondary_uom
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
  WHERE NULLIF(item_payload->>'item_id', '') IS NOT NULL
    AND COALESCE(NULLIF(item_payload->>'quantity_returned', '')::numeric, 0) > 0;

  GET DIAGNOSTICS v_inserted_count = ROW_COUNT;

  IF v_inserted_count <> v_item_count THEN
    RAISE EXCEPTION 'Failed to persist all material return items — aborting to prevent an incomplete draft'
      USING ERRCODE = '23514';
  END IF;

  RETURN v_return_note;
END;
$$;

REVOKE ALL ON FUNCTION public.create_material_return_with_items(date, text, text, text, text, uuid, text, uuid, text, jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.create_material_return_with_items(date, text, text, text, text, uuid, text, uuid, text, jsonb) FROM anon;
GRANT EXECUTE ON FUNCTION public.create_material_return_with_items(date, text, text, text, text, uuid, text, uuid, text, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_material_return_with_items(date, text, text, text, text, uuid, text, uuid, text, jsonb) TO service_role;

-- Approval must be atomic: item lines are checked before stock is posted and status changes.
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
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'User must be authenticated to approve material returns' USING ERRCODE = '28000';
  END IF;

  IF NOT public.is_admin(v_user_id) THEN
    RAISE EXCEPTION 'Only admins can approve material returns' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_mrn
  FROM public.material_return_notes
  WHERE id = p_mrn_id
  FOR UPDATE;

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

  FOR v_item IN
    SELECT * FROM public.material_return_items WHERE mrn_id = p_mrn_id ORDER BY created_at, id
  LOOP
    SELECT id INTO v_bin_allocation_id
    FROM public.warehouse_bin_allocations
    WHERE warehouse_item_id = v_item.item_id
      AND company_id = v_mrn.company_id
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

REVOKE ALL ON FUNCTION public.approve_material_return(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.approve_material_return(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.approve_material_return(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.approve_material_return(uuid) TO service_role;

-- Keep the permanent guard active for new non-cancelled MRNs.
CREATE OR REPLACE FUNCTION public.enforce_material_return_has_items()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.status IS DISTINCT FROM 'cancelled'
     AND NOT EXISTS (
       SELECT 1
       FROM public.material_return_items mri
       WHERE mri.mrn_id = NEW.id
     ) THEN
    RAISE EXCEPTION 'Material return note % cannot be saved without return items', NEW.mrn_number
      USING ERRCODE = '23514';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS constraint_material_return_has_items ON public.material_return_notes;
CREATE CONSTRAINT TRIGGER constraint_material_return_has_items
AFTER INSERT OR UPDATE OF status ON public.material_return_notes
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW
EXECUTE FUNCTION public.enforce_material_return_has_items();