
-- 1. Backfill location_id and company_id from linked MIN
UPDATE public.material_return_notes mrn
SET location_id = COALESCE(mrn.location_id, min.location_id),
    company_id  = COALESCE(mrn.company_id, min.company_id)
FROM public.material_issue_notes min
WHERE mrn.reference_id IS NOT NULL
  AND mrn.reference_type IN ('material_issue','material_issue_note')
  AND min.id = mrn.reference_id
  AND (mrn.location_id IS NULL OR mrn.company_id IS NULL);

-- 2. Backfill location_id from creator's most-used MIN location within the same company
UPDATE public.material_return_notes mrn
SET location_id = sub.location_id
FROM (
  SELECT created_by, company_id, location_id
  FROM (
    SELECT min.created_by, min.company_id, min.location_id,
           ROW_NUMBER() OVER (PARTITION BY min.created_by, min.company_id ORDER BY COUNT(*) DESC) AS rn
    FROM public.material_issue_notes min
    WHERE min.location_id IS NOT NULL
    GROUP BY min.created_by, min.company_id, min.location_id
  ) t
  WHERE t.rn = 1
) sub
WHERE mrn.location_id IS NULL
  AND mrn.created_by IS NOT NULL
  AND mrn.company_id IS NOT NULL
  AND sub.created_by = mrn.created_by
  AND sub.company_id = mrn.company_id;

-- 3. Trigger: require location_id for new inserts
CREATE OR REPLACE FUNCTION public.material_return_notes_require_location()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.location_id IS NULL THEN
    RAISE EXCEPTION 'location_id is required for material return notes'
      USING ERRCODE = '23502';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_mrn_require_location ON public.material_return_notes;
CREATE TRIGGER trg_mrn_require_location
BEFORE INSERT ON public.material_return_notes
FOR EACH ROW EXECUTE FUNCTION public.material_return_notes_require_location();

-- 4. Lock down SELECT/UPDATE/INSERT policies: remove NULL escape hatch
DROP POLICY IF EXISTS "Users can view material return notes scoped by location" ON public.material_return_notes;
CREATE POLICY "Users can view material return notes scoped by location"
ON public.material_return_notes
FOR SELECT
USING (
  can_access_company(company_id)
  AND (
    is_admin(auth.uid())
    OR (location_id IS NOT NULL AND user_has_location_access(auth.uid(), location_id))
  )
);

DROP POLICY IF EXISTS "Users can update their own draft material returns or admins can" ON public.material_return_notes;
CREATE POLICY "Users can update their own draft material returns or admins can"
ON public.material_return_notes
FOR UPDATE
USING (
  (((auth.uid() = created_by) AND (status = 'draft')) OR is_admin(auth.uid()))
  AND (is_admin(auth.uid()) OR (location_id IS NOT NULL AND user_has_location_access(auth.uid(), location_id)))
)
WITH CHECK (
  can_access_company(company_id)
  AND (is_admin(auth.uid()) OR (location_id IS NOT NULL AND user_has_location_access(auth.uid(), location_id)))
);

DROP POLICY IF EXISTS "Users can create material return notes for their locations" ON public.material_return_notes;
CREATE POLICY "Users can create material return notes for their locations"
ON public.material_return_notes
FOR INSERT
WITH CHECK (
  auth.uid() IS NOT NULL
  AND auth.uid() = created_by
  AND can_access_company(company_id)
  AND location_id IS NOT NULL
  AND (is_admin(auth.uid()) OR user_has_location_access(auth.uid(), location_id))
);

-- 5. Tighten material_return_items SELECT policy (remove NULL escape)
DROP POLICY IF EXISTS "Users can view material return items scoped by location" ON public.material_return_items;
CREATE POLICY "Users can view material return items scoped by location"
ON public.material_return_items
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.material_return_notes mrn
    WHERE mrn.id = material_return_items.mrn_id
      AND can_access_company(mrn.company_id)
      AND (
        is_admin(auth.uid())
        OR (mrn.location_id IS NOT NULL AND user_has_location_access(auth.uid(), mrn.location_id))
      )
  )
);
