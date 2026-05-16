ALTER TABLE public.warehouse_bin_allocations
  ADD COLUMN IF NOT EXISTS location_id uuid REFERENCES public.warehouse_locations(id) ON DELETE SET NULL;

WITH latest_positive_location AS (
  SELECT DISTINCT ON (st.item_id, st.bin_id)
         st.item_id,
         st.bin_id,
         st.location_id
  FROM public.stock_transactions st
  WHERE st.bin_id IS NOT NULL
    AND st.location_id IS NOT NULL
    AND COALESCE(st.quantity_change, 0) > 0
  ORDER BY st.item_id, st.bin_id, st.created_at DESC, st.id DESC
)
UPDATE public.warehouse_bin_allocations a
SET location_id = lpl.location_id
FROM latest_positive_location lpl
WHERE a.warehouse_item_id = lpl.item_id
  AND a.bin_id = lpl.bin_id
  AND a.location_id IS NULL;

UPDATE public.warehouse_bin_allocations a
SET location_id = COALESCE(wi.location_id, wb.root_location_id, wb.location_id)
FROM public.warehouse_items wi, public.warehouse_bins wb
WHERE wi.id = a.warehouse_item_id
  AND wb.id = a.bin_id
  AND a.location_id IS NULL;

CREATE INDEX IF NOT EXISTS idx_warehouse_bin_allocations_company_location_item
  ON public.warehouse_bin_allocations (company_id, location_id, warehouse_item_id)
  WHERE allocated_quantity > 0;

CREATE INDEX IF NOT EXISTS idx_warehouse_bin_allocations_location_bin
  ON public.warehouse_bin_allocations (location_id, bin_id)
  WHERE allocated_quantity > 0;

ALTER TABLE public.warehouse_bin_allocations
  DROP CONSTRAINT IF EXISTS unique_item_bin_company;

CREATE UNIQUE INDEX IF NOT EXISTS unique_item_bin_company_location
  ON public.warehouse_bin_allocations (warehouse_item_id, bin_id, company_id, location_id)
  WHERE location_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.validate_bin_allocation_location()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_bin_root uuid;
  v_alloc_root uuid;
  v_item_company uuid;
BEGIN
  SELECT company_id INTO v_item_company
  FROM public.warehouse_items
  WHERE id = NEW.warehouse_item_id;

  IF NEW.company_id IS NULL THEN
    NEW.company_id := v_item_company;
  END IF;

  IF NEW.location_id IS NULL THEN
    SELECT COALESCE(location_id, root_location_id) INTO NEW.location_id
    FROM public.warehouse_items
    WHERE id = NEW.warehouse_item_id;
  END IF;

  IF NEW.location_id IS NULL THEN
    SELECT COALESCE(root_location_id, location_id) INTO NEW.location_id
    FROM public.warehouse_bins
    WHERE id = NEW.bin_id;
  END IF;

  SELECT COALESCE(root_location_id, location_id) INTO v_bin_root
  FROM public.warehouse_bins
  WHERE id = NEW.bin_id;

  v_alloc_root := public.get_root_location_id(NEW.location_id);

  IF v_bin_root IS NOT NULL AND v_alloc_root IS NOT NULL AND v_bin_root <> v_alloc_root THEN
    RAISE EXCEPTION 'Bin belongs to warehouse %, but stock location % is under warehouse %', v_bin_root, NEW.location_id, v_alloc_root
      USING ERRCODE = '23514';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validate_bin_allocation_location ON public.warehouse_bin_allocations;
CREATE TRIGGER trg_validate_bin_allocation_location
BEFORE INSERT OR UPDATE OF warehouse_item_id, bin_id, company_id, location_id
ON public.warehouse_bin_allocations
FOR EACH ROW
EXECUTE FUNCTION public.validate_bin_allocation_location();

CREATE OR REPLACE FUNCTION public.recompute_item_primary_location(p_item_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_loc uuid;
BEGIN
  SELECT COALESCE(a.location_id, b.location_id)
    INTO v_loc
  FROM public.warehouse_bin_allocations a
  JOIN public.warehouse_bins b ON b.id = a.bin_id
  WHERE a.warehouse_item_id = p_item_id
    AND a.available_quantity > 0
    AND COALESCE(a.location_id, b.location_id) IS NOT NULL
  GROUP BY COALESCE(a.location_id, b.location_id)
  ORDER BY SUM(a.available_quantity) DESC
  LIMIT 1;

  IF v_loc IS NOT NULL THEN
    UPDATE public.warehouse_items
       SET location_id = v_loc,
           updated_at = now()
     WHERE id = p_item_id
       AND location_id IS DISTINCT FROM v_loc;
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_company_inventory_at_location(p_company_id uuid, p_location_id uuid)
RETURNS SETOF public.warehouse_items
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  scope_ids uuid[];
  v_root uuid;
BEGIN
  IF p_company_id IS NULL OR p_location_id IS NULL THEN
    RETURN;
  END IF;

  IF NOT public.can_access_company(p_company_id) THEN
    RETURN;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.get_effective_location_company_ids(p_location_id) ec
    WHERE ec.company_id = p_company_id
  ) THEN
    RETURN;
  END IF;

  SELECT array_agg(location_id)
  INTO scope_ids
  FROM public.get_location_subtree_ids(p_location_id);

  v_root := public.get_root_location_id(p_location_id);

  IF scope_ids IS NULL OR cardinality(scope_ids) = 0 THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT DISTINCT ON (wi.created_at, wi.id) wi.*
  FROM public.warehouse_items wi
  WHERE wi.company_id = p_company_id
    AND (
      (wi.location_id = ANY(scope_ids) AND COALESCE(wi.current_stock, 0) > 0)
      OR EXISTS (
        SELECT 1
        FROM public.warehouse_bin_allocations wba
        JOIN public.warehouse_bins wb ON wb.id = wba.bin_id
        WHERE wba.warehouse_item_id = wi.id
          AND wba.available_quantity > 0
          AND (
            wba.location_id = ANY(scope_ids)
            OR (wba.location_id IS NULL AND wb.location_id = ANY(scope_ids))
            OR (wba.location_id IS NULL AND wb.root_location_id = v_root AND p_location_id = v_root)
          )
      )
    )
  ORDER BY wi.created_at DESC, wi.id DESC;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_company_inventory_at_location(uuid, uuid) TO authenticated;