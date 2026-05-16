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
  WITH requested AS (
    SELECT DISTINCT requested.location_id
    FROM unnest(COALESCE(_location_ids, ARRAY[]::uuid[])) AS requested(location_id)
    WHERE requested.location_id IS NOT NULL
  ), scope AS (
    SELECT DISTINCT subtree.location_id
    FROM requested r
    CROSS JOIN LATERAL public.get_location_subtree_ids(r.location_id) AS subtree(location_id)
  ), has_scope AS (
    SELECT EXISTS (SELECT 1 FROM requested) AS value
  ), scoped_alloc AS (
    SELECT
      a.warehouse_item_id,
      a.bin_id,
      SUM(a.available_quantity) AS available_qty,
      SUM(a.reserved_quantity) AS reserved_qty,
      SUM(a.allocated_quantity) AS allocated_qty
    FROM public.warehouse_bin_allocations a
    JOIN public.warehouse_bins wb ON wb.id = a.bin_id
    CROSS JOIN has_scope hs
    WHERE a.available_quantity > 0
      AND (_company_id IS NULL OR a.company_id = _company_id)
      AND (
        hs.value = false
        OR COALESCE(a.location_id, wb.location_id, wb.root_location_id) IN (SELECT location_id FROM scope)
      )
    GROUP BY a.warehouse_item_id, a.bin_id
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
        OR wi.location_id IN (SELECT location_id FROM scope)
      )
      AND (
        _stock_mode IS NULL OR _stock_mode = 'all'
        OR (_stock_mode = 'in_stock' AND COALESCE(CASE WHEN hs.value THEN ist.allocated_qty ELSE wi.current_stock END, 0) > 0)
        OR (_stock_mode = 'zero' AND COALESCE(CASE WHEN hs.value THEN ist.allocated_qty ELSE wi.current_stock END, 0) = 0)
        OR (_stock_mode = 'low' AND COALESCE(CASE WHEN hs.value THEN ist.allocated_qty ELSE wi.current_stock END, 0) <= COALESCE(wi.reorder_level, 0))
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
        'quantity', sa.available_qty
      ) ORDER BY wb.bin_code)
      FROM scoped_alloc sa
      JOIN public.warehouse_bins wb ON wb.id = sa.bin_id
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
  v_alloc_exists boolean;
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

    SELECT EXISTS (
      SELECT 1
      FROM public.warehouse_bin_allocations a
      WHERE a.warehouse_item_id = NEW.item_id
        AND a.bin_id = NEW.bin_id
        AND (v_co IS NULL OR a.company_id = v_co)
    ) INTO v_alloc_exists;

    IF NOT v_alloc_exists THEN
      RAISE EXCEPTION 'bin_id % is not allocated to item %', NEW.bin_id, NEW.item_id;
    END IF;

    IF NEW.location_id IS NOT NULL THEN
      v_tx_root := public.get_root_location_id(NEW.location_id);
      IF v_bin_root IS NOT NULL AND v_tx_root IS NOT NULL AND v_tx_root <> v_bin_root THEN
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

      NEW.location_id := v_alloc_location;
    END IF;
  ELSE
    SELECT COUNT(DISTINCT a.bin_id), MIN(a.bin_id::text)::uuid, MIN(a.location_id::text)::uuid
      INTO v_bin_count, v_single_bin, v_single_location
    FROM public.warehouse_bin_allocations a
    WHERE a.warehouse_item_id = NEW.item_id
      AND (v_co IS NULL OR a.company_id = v_co);

    IF v_bin_count = 1 THEN
      NEW.bin_id := v_single_bin;
      IF NEW.location_id IS NULL THEN
        NEW.location_id := v_single_location;
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;