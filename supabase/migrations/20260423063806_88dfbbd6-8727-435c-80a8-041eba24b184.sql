-- 1. Add allocation mode column
ALTER TABLE public.warehouse_locations
  ADD COLUMN IF NOT EXISTS company_assignment_mode text NOT NULL DEFAULT 'explicit'
  CHECK (company_assignment_mode IN ('explicit', 'inherit_parent'));

-- 2. Backfill: top-level locations -> explicit (already default)
UPDATE public.warehouse_locations
   SET company_assignment_mode = 'explicit'
 WHERE parent_id IS NULL;

-- Children with their own direct mappings -> explicit
UPDATE public.warehouse_locations wl
   SET company_assignment_mode = 'explicit'
 WHERE wl.parent_id IS NOT NULL
   AND EXISTS (
     SELECT 1 FROM public.warehouse_location_companies wlc
      WHERE wlc.location_id = wl.id
   );

-- Children with no direct mappings but parent has mappings -> inherit_parent
UPDATE public.warehouse_locations wl
   SET company_assignment_mode = 'inherit_parent'
 WHERE wl.parent_id IS NOT NULL
   AND NOT EXISTS (
     SELECT 1 FROM public.warehouse_location_companies wlc
      WHERE wlc.location_id = wl.id
   );

-- 3. Resolver: effective company IDs (walks parent chain when inheriting)
CREATE OR REPLACE FUNCTION public.get_effective_location_company_ids(p_location_id uuid)
RETURNS TABLE (company_id uuid)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_mode text;
  v_parent uuid;
  v_current uuid := p_location_id;
  v_depth int := 0;
BEGIN
  LOOP
    EXIT WHEN v_current IS NULL OR v_depth > 20;

    SELECT company_assignment_mode, parent_id
      INTO v_mode, v_parent
      FROM warehouse_locations
     WHERE id = v_current;

    IF NOT FOUND THEN
      RETURN;
    END IF;

    IF v_mode = 'explicit' OR v_parent IS NULL THEN
      RETURN QUERY
        SELECT wlc.company_id FROM warehouse_location_companies wlc
         WHERE wlc.location_id = v_current;
      RETURN;
    END IF;

    v_current := v_parent;
    v_depth := v_depth + 1;
  END LOOP;
END;
$$;
GRANT EXECUTE ON FUNCTION public.get_effective_location_company_ids(uuid) TO authenticated;

-- 4. Admin reader: returns mode + direct + effective + inheritance source
CREATE OR REPLACE FUNCTION public.get_location_company_assignments_admin(p_location_id uuid)
RETURNS TABLE (
  assignment_mode text,
  direct_company_ids uuid[],
  effective_company_ids uuid[],
  inheritance_source_id uuid,
  inheritance_source_name text
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_mode text;
  v_parent uuid;
  v_source uuid;
  v_source_name text;
  v_current uuid;
  v_depth int := 0;
BEGIN
  IF NOT (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'super_admin') OR is_super_admin(auth.uid())) THEN
    RAISE EXCEPTION 'Access denied';
  END IF;

  SELECT company_assignment_mode, parent_id INTO v_mode, v_parent
    FROM warehouse_locations WHERE id = p_location_id;

  IF NOT FOUND THEN
    RETURN;
  END IF;

  -- Walk to find inheritance source if inheriting
  v_current := p_location_id;
  v_source := p_location_id;
  WHILE v_depth < 20 LOOP
    DECLARE v_cmode text; v_cparent uuid; BEGIN
      SELECT company_assignment_mode, parent_id INTO v_cmode, v_cparent
        FROM warehouse_locations WHERE id = v_current;
      IF v_cmode = 'explicit' OR v_cparent IS NULL THEN
        v_source := v_current;
        EXIT;
      END IF;
      v_current := v_cparent;
    END;
    v_depth := v_depth + 1;
  END LOOP;

  SELECT name INTO v_source_name FROM warehouse_locations WHERE id = v_source;

  RETURN QUERY
  SELECT
    v_mode,
    COALESCE((SELECT array_agg(wlc.company_id)
                FROM warehouse_location_companies wlc
               WHERE wlc.location_id = p_location_id), ARRAY[]::uuid[]),
    COALESCE((SELECT array_agg(c) FROM get_effective_location_company_ids(p_location_id) c), ARRAY[]::uuid[]),
    CASE WHEN v_source <> p_location_id THEN v_source ELSE NULL END,
    CASE WHEN v_source <> p_location_id THEN v_source_name ELSE NULL END;
END;
$$;
GRANT EXECUTE ON FUNCTION public.get_location_company_assignments_admin(uuid) TO authenticated;

-- 5. Admin writer: atomic mode + mappings update
CREATE OR REPLACE FUNCTION public.set_location_company_assignments_admin(
  p_location_id uuid,
  p_company_ids uuid[],
  p_assignment_mode text
)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'super_admin') OR is_super_admin(auth.uid())) THEN
    RAISE EXCEPTION 'Access denied: admin role required';
  END IF;

  IF p_assignment_mode NOT IN ('explicit', 'inherit_parent') THEN
    RAISE EXCEPTION 'Invalid assignment mode: %', p_assignment_mode;
  END IF;

  UPDATE warehouse_locations
     SET company_assignment_mode = p_assignment_mode,
         updated_at = now()
   WHERE id = p_location_id;

  -- Always replace direct mappings deterministically
  DELETE FROM warehouse_location_companies WHERE location_id = p_location_id;

  IF p_assignment_mode = 'explicit' AND p_company_ids IS NOT NULL AND array_length(p_company_ids, 1) > 0 THEN
    INSERT INTO warehouse_location_companies (location_id, company_id)
    SELECT p_location_id, unnest(p_company_ids)
    ON CONFLICT DO NOTHING;
  END IF;
END;
$$;
GRANT EXECUTE ON FUNCTION public.set_location_company_assignments_admin(uuid, uuid[], text) TO authenticated;

-- 6. Bulk admin reader: effective companies for many locations (for the master-data table)
CREATE OR REPLACE FUNCTION public.get_all_effective_location_companies()
RETURNS TABLE (
  location_id uuid,
  company_id uuid,
  is_inherited boolean,
  source_location_id uuid
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'super_admin') OR is_super_admin(auth.uid())) THEN
    RETURN;
  END IF;

  RETURN QUERY
  WITH RECURSIVE chain AS (
    SELECT wl.id AS origin_id,
           wl.id AS current_id,
           wl.company_assignment_mode,
           wl.parent_id,
           0 AS depth
      FROM warehouse_locations wl
    UNION ALL
    SELECT c.origin_id,
           wl.id,
           wl.company_assignment_mode,
           wl.parent_id,
           c.depth + 1
      FROM chain c
      JOIN warehouse_locations wl ON wl.id = c.parent_id
     WHERE c.company_assignment_mode = 'inherit_parent'
       AND c.depth < 20
  ),
  resolved AS (
    SELECT DISTINCT ON (origin_id)
           origin_id, current_id
      FROM chain
     WHERE company_assignment_mode = 'explicit' OR parent_id IS NULL
     ORDER BY origin_id, depth ASC
  )
  SELECT r.origin_id,
         wlc.company_id,
         (r.origin_id <> r.current_id) AS is_inherited,
         r.current_id AS source_location_id
    FROM resolved r
    JOIN warehouse_location_companies wlc ON wlc.location_id = r.current_id;
END;
$$;
GRANT EXECUTE ON FUNCTION public.get_all_effective_location_companies() TO authenticated;