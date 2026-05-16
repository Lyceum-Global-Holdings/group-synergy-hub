
-- 1. Drop legacy constraint first so we can move rows to canonical values
ALTER TABLE public.warehouse_locations DROP CONSTRAINT IF EXISTS warehouse_locations_type_check;

-- 2. Normalise types
UPDATE public.warehouse_locations SET type = 'warehouse'
  WHERE (type IN ('location') OR type IS NULL) AND parent_id IS NULL;
UPDATE public.warehouse_locations SET type = 'sublocation'
  WHERE (type IN ('location') OR type IS NULL) AND parent_id IS NOT NULL;

-- 3. Backfill company_id from parent
WITH RECURSIVE tree AS (
  SELECT id, parent_id, company_id FROM public.warehouse_locations WHERE parent_id IS NULL
  UNION ALL
  SELECT l.id, l.parent_id, COALESCE(l.company_id, t.company_id)
  FROM public.warehouse_locations l JOIN tree t ON l.parent_id = t.id
)
UPDATE public.warehouse_locations wl
SET company_id = t.company_id
FROM tree t
WHERE wl.id = t.id AND wl.company_id IS NULL AND t.company_id IS NOT NULL;

-- 4. Infer from bins
UPDATE public.warehouse_locations wl
SET company_id = sub.cid
FROM (
  SELECT location_id, (mode() WITHIN GROUP (ORDER BY company_id))::uuid AS cid
  FROM public.warehouse_bins WHERE company_id IS NOT NULL GROUP BY location_id
) sub
WHERE wl.id = sub.location_id AND wl.company_id IS NULL;

-- 5. Align sub-location company with parent
UPDATE public.warehouse_locations wl
SET company_id = p.company_id
FROM public.warehouse_locations p
WHERE wl.parent_id = p.id
  AND p.company_id IS NOT NULL
  AND wl.company_id IS DISTINCT FROM p.company_id;

-- 6. Apply new constraint
ALTER TABLE public.warehouse_locations
  ADD CONSTRAINT warehouse_locations_type_check
  CHECK (type IN ('warehouse','sublocation','department'));

-- 7. Validation trigger
CREATE OR REPLACE FUNCTION public.validate_warehouse_location_hierarchy()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE parent_row public.warehouse_locations%ROWTYPE;
BEGIN
  IF NEW.parent_id IS NULL THEN
    NEW.type := 'warehouse';
  ELSE
    SELECT * INTO parent_row FROM public.warehouse_locations WHERE id = NEW.parent_id;
    IF NOT FOUND THEN RAISE EXCEPTION 'Parent location % does not exist', NEW.parent_id; END IF;
    IF parent_row.parent_id IS NOT NULL THEN
      RAISE EXCEPTION 'Sub-locations cannot be nested. Parent is already a sub-location.';
    END IF;
    IF NEW.company_id IS DISTINCT FROM parent_row.company_id AND parent_row.company_id IS NOT NULL THEN
      RAISE EXCEPTION 'Sub-location company must match parent warehouse company';
    END IF;
    IF NEW.type NOT IN ('sublocation','department') THEN NEW.type := 'sublocation'; END IF;
    IF NEW.company_id IS NULL THEN NEW.company_id := parent_row.company_id; END IF;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_validate_warehouse_location_hierarchy ON public.warehouse_locations;
CREATE TRIGGER trg_validate_warehouse_location_hierarchy
BEFORE INSERT OR UPDATE OF parent_id, type, company_id ON public.warehouse_locations
FOR EACH ROW EXECUTE FUNCTION public.validate_warehouse_location_hierarchy();

-- 8. Ancestors RPC
CREATE OR REPLACE FUNCTION public.get_location_ancestors(_location_id uuid)
RETURNS TABLE(id uuid, name text, type text, parent_id uuid, company_id uuid, depth int)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public AS $$
  WITH RECURSIVE chain AS (
    SELECT l.id, l.name, l.type, l.parent_id, l.company_id, 0 AS depth
    FROM public.warehouse_locations l WHERE l.id = _location_id
    UNION ALL
    SELECT p.id, p.name, p.type, p.parent_id, p.company_id, c.depth + 1
    FROM public.warehouse_locations p JOIN chain c ON p.id = c.parent_id
  )
  SELECT * FROM chain ORDER BY depth DESC;
$$;

-- 9. Hierarchy RPC
CREATE OR REPLACE FUNCTION public.get_location_hierarchy(_company_id uuid DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path = public AS $$
DECLARE result jsonb;
BEGIN
  WITH loc AS (
    SELECT l.id, l.name, l.type, l.parent_id, l.company_id, l.location_code, l.status,
           c.name AS company_name
    FROM public.warehouse_locations l
    LEFT JOIN public.companies c ON c.id = l.company_id
    WHERE _company_id IS NULL OR l.company_id = _company_id OR l.company_id IS NULL
  ),
  bin_counts AS (
    SELECT location_id, count(*)::int AS bin_count FROM public.warehouse_bins GROUP BY location_id
  ),
  stock_counts AS (
    SELECT a.location_id, count(DISTINCT a.warehouse_item_id)::int AS sku_count,
           COALESCE(SUM(a.allocated_quantity),0)::numeric AS total_qty
    FROM public.warehouse_bin_allocations a
    WHERE a.location_id IS NOT NULL GROUP BY a.location_id
  ),
  enriched AS (
    SELECT l.*,
           COALESCE(bc.bin_count,0) AS bin_count,
           COALESCE(sc.sku_count,0) AS sku_count,
           COALESCE(sc.total_qty,0) AS total_qty
    FROM loc l
    LEFT JOIN bin_counts bc ON bc.location_id = l.id
    LEFT JOIN stock_counts sc ON sc.location_id = l.id
  ),
  subs AS (
    SELECT parent_id, jsonb_agg(jsonb_build_object(
      'id', id, 'name', name, 'type', type, 'location_code', location_code,
      'status', status, 'company_id', company_id, 'company_name', company_name,
      'bin_count', bin_count, 'sku_count', sku_count, 'total_qty', total_qty
    ) ORDER BY name) AS children
    FROM enriched WHERE parent_id IS NOT NULL GROUP BY parent_id
  ),
  warehouses AS (
    SELECT e.company_id, jsonb_agg(jsonb_build_object(
      'id', e.id, 'name', e.name, 'type', e.type, 'location_code', e.location_code,
      'status', e.status, 'company_id', e.company_id, 'company_name', e.company_name,
      'bin_count', e.bin_count, 'sku_count', e.sku_count, 'total_qty', e.total_qty,
      'children', COALESCE(s.children, '[]'::jsonb)
    ) ORDER BY e.name) AS warehouses
    FROM enriched e LEFT JOIN subs s ON s.parent_id = e.id
    WHERE e.parent_id IS NULL GROUP BY e.company_id
  )
  SELECT jsonb_agg(jsonb_build_object(
    'company_id', e.id,
    'company_name', COALESCE(c.name, 'Unassigned'),
    'warehouses', COALESCE(w.warehouses, '[]'::jsonb)
  ) ORDER BY COALESCE(c.name, 'ZZZ_Unassigned'))
  INTO result
  FROM (SELECT DISTINCT company_id AS id FROM enriched) e
  LEFT JOIN public.companies c ON c.id = e.id
  LEFT JOIN warehouses w ON w.company_id IS NOT DISTINCT FROM e.id;

  RETURN COALESCE(result, '[]'::jsonb);
END $$;

GRANT EXECUTE ON FUNCTION public.get_location_hierarchy(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_location_ancestors(uuid) TO authenticated;
