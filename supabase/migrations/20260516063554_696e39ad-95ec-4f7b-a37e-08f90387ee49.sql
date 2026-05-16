-- Permanent WMS location fix: allocation.location_id is the physical stock node.

-- 1) Backfill missing allocation locations safely: transaction history > item location within bin root > bin root.
WITH latest_tx_location AS (
  SELECT DISTINCT ON (st.item_id, st.bin_id, st.company_id)
         st.item_id,
         st.bin_id,
         st.company_id,
         st.location_id
  FROM public.stock_transactions st
  WHERE st.bin_id IS NOT NULL
    AND st.location_id IS NOT NULL
    AND COALESCE(st.quantity_change, 0) <> 0
  ORDER BY st.item_id, st.bin_id, st.company_id, st.created_at DESC, st.id DESC
)
UPDATE public.warehouse_bin_allocations a
SET location_id = l.location_id,
    updated_at = now()
FROM latest_tx_location l
WHERE a.location_id IS NULL
  AND a.warehouse_item_id = l.item_id
  AND a.bin_id = l.bin_id
  AND (a.company_id IS NOT DISTINCT FROM l.company_id OR a.company_id IS NULL);

UPDATE public.warehouse_bin_allocations a
SET location_id = CASE
    WHEN wi.location_id IS NOT NULL
     AND public.get_root_location_id(wi.location_id) IS NOT DISTINCT FROM COALESCE(wb.root_location_id, wb.location_id)
      THEN wi.location_id
    ELSE COALESCE(wb.root_location_id, wb.location_id)
  END,
  company_id = COALESCE(a.company_id, wi.company_id),
  updated_at = now()
FROM public.warehouse_items wi, public.warehouse_bins wb
WHERE wi.id = a.warehouse_item_id
  AND wb.id = a.bin_id
  AND a.location_id IS NULL;

-- 2) Guard allocation writes so location_id is always the physical node under the bin's root warehouse.
CREATE OR REPLACE FUNCTION public.validate_bin_allocation_location()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_bin_root uuid;
  v_item_company uuid;
  v_item_location uuid;
  v_latest_tx_location uuid;
  v_alloc_root uuid;
BEGIN
  SELECT company_id, location_id
    INTO v_item_company, v_item_location
  FROM public.warehouse_items
  WHERE id = NEW.warehouse_item_id;

  NEW.company_id := COALESCE(NEW.company_id, v_item_company);
  IF NEW.company_id IS NULL THEN
    RAISE EXCEPTION 'company_id is required for bin allocation' USING ERRCODE = '23502';
  END IF;

  SELECT COALESCE(root_location_id, location_id)
    INTO v_bin_root
  FROM public.warehouse_bins
  WHERE id = NEW.bin_id;

  IF NEW.location_id IS NULL THEN
    SELECT st.location_id
      INTO v_latest_tx_location
    FROM public.stock_transactions st
    WHERE st.item_id = NEW.warehouse_item_id
      AND st.bin_id = NEW.bin_id
      AND st.location_id IS NOT NULL
      AND (st.company_id IS NOT DISTINCT FROM NEW.company_id OR st.company_id IS NULL)
    ORDER BY st.created_at DESC, st.id DESC
    LIMIT 1;

    NEW.location_id := CASE
      WHEN v_latest_tx_location IS NOT NULL
       AND public.get_root_location_id(v_latest_tx_location) IS NOT DISTINCT FROM v_bin_root
        THEN v_latest_tx_location
      WHEN v_item_location IS NOT NULL
       AND public.get_root_location_id(v_item_location) IS NOT DISTINCT FROM v_bin_root
        THEN v_item_location
      ELSE v_bin_root
    END;
  END IF;

  IF NEW.location_id IS NULL THEN
    RAISE EXCEPTION 'location_id is required for bin allocation' USING ERRCODE = '23502';
  END IF;

  v_alloc_root := public.get_root_location_id(NEW.location_id);
  IF v_bin_root IS NOT NULL AND v_alloc_root IS NOT NULL AND v_alloc_root IS DISTINCT FROM v_bin_root THEN
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

-- 3) Remove legacy behavior that used bin master location to overwrite item master location.
DROP TRIGGER IF EXISTS trg_sync_item_location_from_allocation ON public.warehouse_bin_allocations;
DROP TRIGGER IF EXISTS trg_sync_items_when_bin_relocated ON public.warehouse_bins;

CREATE OR REPLACE FUNCTION public.recompute_item_primary_location(p_item_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Compatibility no-op. Physical stock location is warehouse_bin_allocations.location_id.
  RETURN;
END;
$$;

CREATE OR REPLACE FUNCTION public.tg_sync_item_location_from_allocation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.tg_sync_items_when_bin_relocated()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  RETURN NEW;
END;
$$;

-- 4) Keep stock transaction location aligned with the physical allocation node.
CREATE OR REPLACE FUNCTION public.stock_transactions_location_guard()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_co uuid;
  v_bin_root uuid;
  v_tx_root uuid;
  v_alloc_location uuid;
  v_single_bin uuid;
  v_single_location uuid;
  v_bin_count int;
BEGIN
  SELECT company_id INTO v_co
  FROM public.warehouse_items
  WHERE id = NEW.item_id;

  IF v_co IS NOT NULL THEN
    NEW.company_id := v_co;
  END IF;

  IF NEW.bin_id IS NOT NULL THEN
    SELECT COALESCE(root_location_id, location_id)
      INTO v_bin_root
    FROM public.warehouse_bins
    WHERE id = NEW.bin_id;

    IF NEW.location_id IS NOT NULL THEN
      v_tx_root := public.get_root_location_id(NEW.location_id);
      IF v_bin_root IS NOT NULL AND v_tx_root IS NOT NULL AND v_tx_root IS DISTINCT FROM v_bin_root THEN
        RAISE EXCEPTION 'transaction location % is outside bin warehouse %', NEW.location_id, v_bin_root
          USING ERRCODE = '23514';
      END IF;
    ELSE
      SELECT a.location_id
        INTO v_alloc_location
      FROM public.warehouse_bin_allocations a
      WHERE a.warehouse_item_id = NEW.item_id
        AND a.bin_id = NEW.bin_id
        AND (v_co IS NULL OR a.company_id = v_co)
        AND a.location_id IS NOT NULL
      ORDER BY a.available_quantity DESC, a.updated_at DESC NULLS LAST, a.created_at DESC NULLS LAST
      LIMIT 1;

      NEW.location_id := COALESCE(v_alloc_location, v_bin_root);
    END IF;
  ELSE
    SELECT COUNT(DISTINCT a.bin_id), MIN(a.bin_id::text)::uuid, MIN(a.location_id::text)::uuid
      INTO v_bin_count, v_single_bin, v_single_location
    FROM public.warehouse_bin_allocations a
    WHERE a.warehouse_item_id = NEW.item_id
      AND (v_co IS NULL OR a.company_id = v_co)
      AND a.available_quantity > 0;

    IF v_bin_count = 1 THEN
      NEW.bin_id := v_single_bin;
      NEW.location_id := COALESCE(NEW.location_id, v_single_location);
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

-- 5) Canonical inventory RPC: allocation.location_id controls physical stock visibility.
DROP FUNCTION IF EXISTS public.list_warehouse_inventory(uuid, text, uuid, text, uuid[], timestamptz, uuid, int, text);
DROP FUNCTION IF EXISTS public.list_warehouse_inventory(uuid, text, uuid, text, uuid[], timestamptz, uuid, int, text, uuid);

CREATE OR REPLACE FUNCTION public.list_warehouse_inventory(
  _company_id uuid DEFAULT NULL::uuid,
  _search text DEFAULT NULL::text,
  _category_id uuid DEFAULT NULL::uuid,
  _status text DEFAULT NULL::text,
  _location_ids uuid[] DEFAULT NULL::uuid[],
  _cursor_created_at timestamptz DEFAULT NULL::timestamptz,
  _cursor_id uuid DEFAULT NULL::uuid,
  _limit integer DEFAULT 50,
  _stock_mode text DEFAULT NULL::text,
  _supplier_id uuid DEFAULT NULL::uuid
)
RETURNS TABLE(
  id uuid,
  item_code text,
  name text,
  description text,
  category_id uuid,
  category_name text,
  unit_id uuid,
  unit_name text,
  unit_abbreviation text,
  brand text,
  manufacturer text,
  supplier_id uuid,
  supplier_name text,
  status text,
  current_stock numeric,
  available_quantity numeric,
  reserved_quantity numeric,
  unit_cost numeric,
  selling_price numeric,
  reorder_level numeric,
  min_stock_level numeric,
  max_stock_level numeric,
  image_url text,
  company_id uuid,
  created_at timestamptz,
  updated_at timestamptz,
  bins jsonb
)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path TO 'public'
AS $$
  WITH RECURSIVE requested AS (
    SELECT DISTINCT x.location_id
    FROM unnest(COALESCE(_location_ids, ARRAY[]::uuid[])) AS x(location_id)
    WHERE x.location_id IS NOT NULL
  ), scope(location_id) AS (
    SELECT r.location_id FROM requested r
    UNION ALL
    SELECT child.id
    FROM public.warehouse_locations child
    JOIN scope s ON child.parent_id = s.location_id
    WHERE child.status IS DISTINCT FROM 'inactive'
  ), distinct_scope AS (
    SELECT DISTINCT location_id FROM scope
  ), has_scope AS (
    SELECT EXISTS (SELECT 1 FROM requested) AS value
  ), scoped_alloc AS (
    SELECT
      a.warehouse_item_id,
      a.bin_id,
      a.location_id AS stock_location_id,
      SUM(a.available_quantity) AS available_qty,
      SUM(a.reserved_quantity) AS reserved_qty,
      SUM(a.allocated_quantity) AS allocated_qty
    FROM public.warehouse_bin_allocations a
    CROSS JOIN has_scope hs
    WHERE a.allocated_quantity > 0
      AND (_company_id IS NULL OR a.company_id = _company_id)
      AND (
        hs.value = false
        OR a.location_id IN (SELECT location_id FROM distinct_scope)
      )
    GROUP BY a.warehouse_item_id, a.bin_id, a.location_id
  ), item_stock AS (
    SELECT
      warehouse_item_id,
      SUM(available_qty) AS available_qty,
      SUM(reserved_qty) AS reserved_qty,
      SUM(allocated_qty) AS allocated_qty
    FROM scoped_alloc
    GROUP BY warehouse_item_id
  ), base AS (
    SELECT wi.*, ist.available_qty, ist.reserved_qty, ist.allocated_qty
    FROM public.warehouse_items wi
    LEFT JOIN item_stock ist ON ist.warehouse_item_id = wi.id
    CROSS JOIN has_scope hs
    WHERE (_company_id IS NULL OR wi.company_id = _company_id)
      AND (_category_id IS NULL OR wi.category_id = _category_id)
      AND (_supplier_id IS NULL OR wi.supplier_id = _supplier_id)
      AND (_status IS NULL OR wi.status = _status)
      AND (
        _search IS NULL OR _search = ''
        OR wi.name ILIKE '%' || _search || '%'
        OR wi.item_code ILIKE '%' || _search || '%'
        OR COALESCE(wi.brand,'') ILIKE '%' || _search || '%'
        OR COALESCE(wi.barcode,'') ILIKE '%' || _search || '%'
        OR COALESCE(wi.sku,'') ILIKE '%' || _search || '%'
      )
      AND (
        hs.value = false
        OR COALESCE(ist.allocated_qty, 0) > 0
        OR (
          _stock_mode = 'zero'
          AND wi.location_id IN (SELECT location_id FROM distinct_scope)
          AND COALESCE(ist.allocated_qty, 0) = 0
        )
      )
      AND (
        _stock_mode IS NULL OR _stock_mode = 'all'
        OR (_stock_mode = 'in_stock' AND COALESCE(CASE WHEN hs.value THEN ist.allocated_qty ELSE wi.current_stock END, 0) > 0)
        OR (_stock_mode = 'zero' AND COALESCE(CASE WHEN hs.value THEN ist.allocated_qty ELSE wi.current_stock END, 0) = 0)
        OR (_stock_mode = 'low' AND COALESCE(CASE WHEN hs.value THEN ist.allocated_qty ELSE wi.current_stock END, 0) > 0 AND COALESCE(CASE WHEN hs.value THEN ist.allocated_qty ELSE wi.current_stock END, 0) <= COALESCE(wi.reorder_level, 0))
      )
      AND (
        _cursor_created_at IS NULL
        OR wi.created_at < _cursor_created_at
        OR (wi.created_at = _cursor_created_at AND wi.id < _cursor_id)
      )
    ORDER BY wi.created_at DESC, wi.id DESC
    LIMIT GREATEST(_limit, 1)
  )
  SELECT
    b.id,
    b.item_code,
    b.name,
    b.description,
    b.category_id,
    c.name AS category_name,
    b.unit_id,
    u.name AS unit_name,
    u.abbreviation AS unit_abbreviation,
    b.brand,
    b.manufacturer,
    b.supplier_id,
    s.name AS supplier_name,
    b.status,
    COALESCE(CASE WHEN hs.value THEN b.allocated_qty ELSE b.current_stock END, 0) AS current_stock,
    COALESCE(CASE WHEN hs.value THEN b.available_qty ELSE b.available_quantity END, 0) AS available_quantity,
    COALESCE(CASE WHEN hs.value THEN b.reserved_qty ELSE b.reserved_quantity END, 0) AS reserved_quantity,
    b.unit_cost,
    b.selling_price,
    b.reorder_level,
    b.min_stock_level,
    b.max_stock_level,
    b.image_url,
    b.company_id,
    b.created_at,
    b.updated_at,
    COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', wb.id,
        'bin_code', wb.bin_code,
        'name', wb.name,
        'quantity', sa.available_qty,
        'allocated_quantity', sa.allocated_qty,
        'reserved_quantity', sa.reserved_qty,
        'location_id', sa.stock_location_id,
        'location_name', wl.name,
        'root_location_id', COALESCE(wb.root_location_id, wb.location_id)
      ) ORDER BY wl.name NULLS LAST, wb.bin_code)
      FROM scoped_alloc sa
      JOIN public.warehouse_bins wb ON wb.id = sa.bin_id
      LEFT JOIN public.warehouse_locations wl ON wl.id = sa.stock_location_id
      WHERE sa.warehouse_item_id = b.id
    ), '[]'::jsonb) AS bins
  FROM base b
  CROSS JOIN has_scope hs
  LEFT JOIN public.item_categories c ON c.id = b.category_id
  LEFT JOIN public.item_units u ON u.id = b.unit_id
  LEFT JOIN public.suppliers s ON s.id = b.supplier_id
  ORDER BY b.created_at DESC, b.id DESC;
$$;

REVOKE ALL ON FUNCTION public.list_warehouse_inventory(uuid, text, uuid, text, uuid[], timestamptz, uuid, int, text, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.list_warehouse_inventory(uuid, text, uuid, text, uuid[], timestamptz, uuid, int, text, uuid) TO authenticated;

-- 6) Location item resolver follows allocations, not bin master location.
CREATE OR REPLACE FUNCTION public.get_company_inventory_at_location(p_company_id uuid, p_location_id uuid)
RETURNS SETOF public.warehouse_items
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF p_company_id IS NULL OR p_location_id IS NULL THEN
    RETURN;
  END IF;

  IF NOT public.can_access_company(p_company_id) THEN
    RETURN;
  END IF;

  RETURN QUERY
  WITH RECURSIVE scope(location_id) AS (
    SELECT p_location_id
    UNION ALL
    SELECT child.id
    FROM public.warehouse_locations child
    JOIN scope s ON child.parent_id = s.location_id
    WHERE child.status IS DISTINCT FROM 'inactive'
  ), stock_items AS (
    SELECT DISTINCT wba.warehouse_item_id
    FROM public.warehouse_bin_allocations wba
    WHERE wba.company_id = p_company_id
      AND wba.available_quantity > 0
      AND wba.location_id IN (SELECT location_id FROM scope)
  )
  SELECT wi.*
  FROM public.warehouse_items wi
  JOIN stock_items si ON si.warehouse_item_id = wi.id
  WHERE wi.company_id = p_company_id
  ORDER BY wi.created_at DESC, wi.id DESC;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_company_inventory_at_location(uuid, uuid) TO authenticated;

-- 7) Align item master totals with allocation ledger. Do not touch generated available_quantity.
WITH totals AS (
  SELECT
    wi.id,
    COALESCE(SUM(a.allocated_quantity), 0) AS allocated_total,
    COALESCE(SUM(a.reserved_quantity), 0) AS reserved_total
  FROM public.warehouse_items wi
  LEFT JOIN public.warehouse_bin_allocations a ON a.warehouse_item_id = wi.id
  GROUP BY wi.id
)
UPDATE public.warehouse_items wi
SET current_stock = totals.allocated_total,
    reserved_quantity = totals.reserved_total,
    updated_at = now()
FROM totals
WHERE wi.id = totals.id
  AND (wi.current_stock IS DISTINCT FROM totals.allocated_total
       OR COALESCE(wi.reserved_quantity, 0) IS DISTINCT FROM totals.reserved_total);

CREATE INDEX IF NOT EXISTS idx_warehouse_bin_allocations_company_location_item_positive
  ON public.warehouse_bin_allocations (company_id, location_id, warehouse_item_id, bin_id)
  WHERE allocated_quantity > 0;

CREATE INDEX IF NOT EXISTS idx_warehouse_items_company_created
  ON public.warehouse_items (company_id, created_at DESC, id DESC);
