
-- 1. Add location_id column
ALTER TABLE public.material_return_notes
  ADD COLUMN IF NOT EXISTS location_id uuid REFERENCES public.warehouse_locations(id);

-- 2. Backfill from referenced material_issue_notes when possible
UPDATE public.material_return_notes mrn
SET location_id = min.location_id
FROM public.material_issue_notes min
WHERE mrn.location_id IS NULL
  AND mrn.reference_type = 'material_issue'
  AND mrn.reference_id = min.id
  AND min.location_id IS NOT NULL;

-- 3. Index for scoped list queries
CREATE INDEX IF NOT EXISTS idx_material_return_notes_company_location_created
  ON public.material_return_notes (company_id, location_id, created_at DESC);

-- 4. Replace SELECT policy with location-scoped rule
DROP POLICY IF EXISTS "Users can view material return notes in their company"
  ON public.material_return_notes;

CREATE POLICY "Users can view material return notes scoped by location"
  ON public.material_return_notes
  FOR SELECT
  USING (
    public.can_access_company(company_id)
    AND (
      location_id IS NULL
      OR public.is_admin(auth.uid())
      OR public.user_has_location_access(auth.uid(), location_id)
    )
  );

-- 5. Tighten INSERT policy
DROP POLICY IF EXISTS "Authenticated users can create material return notes"
  ON public.material_return_notes;

CREATE POLICY "Users can create material return notes for their locations"
  ON public.material_return_notes
  FOR INSERT
  WITH CHECK (
    auth.uid() IS NOT NULL
    AND auth.uid() = created_by
    AND public.can_access_company(company_id)
    AND (
      public.is_admin(auth.uid())
      OR (location_id IS NOT NULL AND public.user_has_location_access(auth.uid(), location_id))
    )
  );

-- 6. Extend UPDATE policy with the same location guard
DROP POLICY IF EXISTS "Users can update their own draft material returns or admins can"
  ON public.material_return_notes;

CREATE POLICY "Users can update their own draft material returns or admins can"
  ON public.material_return_notes
  FOR UPDATE
  USING (
    (
      ((auth.uid() = created_by) AND (status = 'draft'))
      OR public.is_admin(auth.uid())
    )
    AND (
      location_id IS NULL
      OR public.is_admin(auth.uid())
      OR public.user_has_location_access(auth.uid(), location_id)
    )
  )
  WITH CHECK (
    public.can_access_company(company_id)
    AND (
      public.is_admin(auth.uid())
      OR (location_id IS NOT NULL AND public.user_has_location_access(auth.uid(), location_id))
    )
  );

-- 7. Item-side visibility must mirror parent visibility
DROP POLICY IF EXISTS "Users can view material return items for accessible companies"
  ON public.material_return_items;

CREATE POLICY "Users can view material return items scoped by location"
  ON public.material_return_items
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.material_return_notes mrn
      WHERE mrn.id = material_return_items.mrn_id
        AND public.can_access_company(mrn.company_id)
        AND (
          mrn.location_id IS NULL
          OR public.is_admin(auth.uid())
          OR public.user_has_location_access(auth.uid(), mrn.location_id)
        )
    )
  );

-- 8. Extend create_material_return_with_items to accept and validate p_location_id
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
AS $function$
DECLARE
  v_user_id uuid := auth.uid();
  v_mrn_number text;
  v_return_note public.material_return_notes;
  v_item_count integer;
  v_invalid_count integer;
  v_total_value numeric := 0;
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

  IF NOT public.is_admin(v_user_id) THEN
    IF p_location_id IS NULL THEN
      RAISE EXCEPTION 'A location is required for material return notes' USING ERRCODE = '23502';
    END IF;
    IF NOT public.user_has_location_access(v_user_id, p_location_id) THEN
      RAISE EXCEPTION 'You do not have access to this location' USING ERRCODE = '42501';
    END IF;
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
    condition, notes, secondary_quantity_returned, secondary_uom
  )
  SELECT
    v_return_note.id,
    (item_payload->>'item_id')::uuid,
    (item_payload->>'quantity_returned')::numeric,
    COALESCE(NULLIF(item_payload->>'unit_cost', '')::numeric, 0),
    COALESCE(
      NULLIF(item_payload->>'total_cost', '')::numeric,
      (item_payload->>'quantity_returned')::numeric
        * COALESCE(NULLIF(item_payload->>'unit_cost', '')::numeric, 0)
    ),
    COALESCE(NULLIF(item_payload->>'condition', ''), 'good'),
    NULLIF(btrim(COALESCE(item_payload->>'notes', '')), ''),
    NULLIF(item_payload->>'secondary_quantity_returned', '')::numeric,
    NULLIF(btrim(COALESCE(item_payload->>'secondary_uom', '')), '')
  FROM jsonb_array_elements(COALESCE(p_items, '[]'::jsonb)) AS item_payload
  WHERE (item_payload->>'quantity_returned')::numeric > 0;

  RETURN v_return_note;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.create_material_return_with_items(
  date, text, text, text, text, uuid, text, uuid, text, jsonb, uuid
) TO authenticated;
