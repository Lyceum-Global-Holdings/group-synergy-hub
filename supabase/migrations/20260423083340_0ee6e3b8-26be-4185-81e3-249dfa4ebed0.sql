-- Standalone sub-location warehouses with independent multi-company inventory
-- Aligned with SAP EWM (any node can be a stocking warehouse), GS1 GLN (stable location identity),
-- ISO 8000 (single authoritative master-data resolution), ISO/IEC 27001 A.9 (server-side scoping).

-- 1) Add is_standalone_warehouse flag
ALTER TABLE public.warehouse_locations
  ADD COLUMN IF NOT EXISTS is_standalone_warehouse boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.warehouse_locations.is_standalone_warehouse IS
  'When true, this node operates as its own stock-bearing warehouse independent of its parent. Must use explicit company assignment.';

-- 2) Trigger: standalone => assignment_mode must be explicit
CREATE OR REPLACE FUNCTION public.enforce_standalone_explicit_assignment()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.is_standalone_warehouse = true AND NEW.company_assignment_mode <> 'explicit' THEN
    NEW.company_assignment_mode := 'explicit';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_standalone_explicit_assignment ON public.warehouse_locations;
CREATE TRIGGER trg_enforce_standalone_explicit_assignment
  BEFORE INSERT OR UPDATE ON public.warehouse_locations
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_standalone_explicit_assignment();

-- 3) Backfill: any sub-location/department whose explicit company set differs from its parent
--    becomes a standalone warehouse.
WITH child_companies AS (
  SELECT wl.id AS location_id,
         array_agg(DISTINCT wlc.company_id ORDER BY wlc.company_id) AS company_ids
  FROM public.warehouse_locations wl
  LEFT JOIN public.warehouse_location_companies wlc ON wlc.location_id = wl.id
  WHERE wl.parent_id IS NOT NULL
    AND wl.company_assignment_mode = 'explicit'
  GROUP BY wl.id
),
parent_companies AS (
  SELECT wl.id AS parent_id,
         array_agg(DISTINCT wlc.company_id ORDER BY wlc.company_id) AS company_ids
  FROM public.warehouse_locations wl
  LEFT JOIN public.warehouse_location_companies wlc ON wlc.location_id = wl.id
  GROUP BY wl.id
)
UPDATE public.warehouse_locations wl
   SET is_standalone_warehouse = true
  FROM child_companies cc
  JOIN public.warehouse_locations parent ON parent.id = (
    SELECT parent_id FROM public.warehouse_locations WHERE id = cc.location_id
  )
  LEFT JOIN parent_companies pc ON pc.parent_id = parent.id
 WHERE wl.id = cc.location_id
   AND wl.is_standalone_warehouse = false
   AND COALESCE(cc.company_ids, ARRAY[]::uuid[]) IS DISTINCT FROM COALESCE(pc.company_ids, ARRAY[]::uuid[])
   AND COALESCE(array_length(cc.company_ids, 1), 0) > 0;

-- 4) RPC: stock-bearing locations for a single company.
--    Returns ALL nodes (location/sublocation/department) where the given company has effective access.
DROP FUNCTION IF EXISTS public.get_stock_bearing_locations_for_company(uuid);
CREATE OR REPLACE FUNCTION public.get_stock_bearing_locations_for_company(p_company_id uuid)
RETURNS TABLE (
  id uuid,
  name text,
  type text,
  parent_id uuid,
  is_standalone_warehouse boolean,
  depth integer
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_company_id IS NULL THEN
    RETURN;
  END IF;

  IF NOT can_access_company(p_company_id) THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT
    wl.id,
    wl.name,
    wl.type,
    wl.parent_id,
    wl.is_standalone_warehouse,
    (CASE wl.type WHEN 'location' THEN 0 WHEN 'sublocation' THEN 1 ELSE 2 END)::integer AS depth
  FROM public.warehouse_locations wl
  WHERE wl.status IS DISTINCT FROM 'inactive'
    AND EXISTS (
      SELECT 1
      FROM public.get_effective_location_company_ids(wl.id) ec
      WHERE ec.company_id = p_company_id
    )
  ORDER BY
    (CASE wl.type WHEN 'location' THEN 0 WHEN 'sublocation' THEN 1 ELSE 2 END),
    wl.name;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_stock_bearing_locations_for_company(uuid) TO authenticated;

-- 5) RPC: per-company inventory at a single physical location.
--    Guarantees per-company inventory isolation when many companies share a sub-location.
DROP FUNCTION IF EXISTS public.get_company_inventory_at_location(uuid, uuid);
CREATE OR REPLACE FUNCTION public.get_company_inventory_at_location(
  p_company_id uuid,
  p_location_id uuid
)
RETURNS SETOF public.warehouse_items
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_company_id IS NULL OR p_location_id IS NULL THEN
    RETURN;
  END IF;

  IF NOT can_access_company(p_company_id) THEN
    RETURN;
  END IF;

  -- Verify the company actually has effective access to this location
  IF NOT EXISTS (
    SELECT 1
    FROM public.get_effective_location_company_ids(p_location_id) ec
    WHERE ec.company_id = p_company_id
  ) THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT wi.*
  FROM public.warehouse_items wi
  WHERE wi.company_id = p_company_id
    AND wi.location_id = p_location_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_company_inventory_at_location(uuid, uuid) TO authenticated;