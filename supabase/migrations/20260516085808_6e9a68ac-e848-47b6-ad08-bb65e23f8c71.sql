
CREATE OR REPLACE FUNCTION public.list_warehouse_inventory(_company_id uuid DEFAULT NULL::uuid, _search text DEFAULT NULL::text, _category_id uuid DEFAULT NULL::uuid, _status text DEFAULT NULL::text, _location_ids uuid[] DEFAULT NULL::uuid[], _cursor_created_at timestamp with time zone DEFAULT NULL::timestamp with time zone, _cursor_id uuid DEFAULT NULL::uuid, _limit integer DEFAULT 50, _stock_mode text DEFAULT NULL::text, _supplier_id uuid DEFAULT NULL::uuid)
 RETURNS TABLE(id uuid, item_code text, name text, description text, category_id uuid, category_name text, unit_id uuid, unit_name text, unit_abbreviation text, brand text, manufacturer text, supplier_id uuid, supplier_name text, status text, current_stock numeric, available_quantity numeric, reserved_quantity numeric, unit_cost numeric, selling_price numeric, reorder_level numeric, min_stock_level numeric, max_stock_level numeric, image_url text, company_id uuid, created_at timestamp with time zone, updated_at timestamp with time zone, bins jsonb)
 LANGUAGE sql
 STABLE
 SET search_path TO 'public'
AS $function$
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
  ), scoped_alloc_full AS (
    SELECT
      a.warehouse_item_id,
      a.bin_id,
      a.location_id AS stock_location_id,
      SUM(a.available_quantity) AS available_qty,
      SUM(a.reserved_quantity) AS reserved_qty,
      SUM(a.allocated_quantity) AS allocated_qty
    FROM public.warehouse_bin_allocations a
    CROSS JOIN has_scope hs
    WHERE (_company_id IS NULL OR a.company_id = _company_id)
      AND (
        hs.value = false
        OR a.location_id IN (SELECT location_id FROM distinct_scope)
      )
    GROUP BY a.warehouse_item_id, a.bin_id, a.location_id
  ), scoped_alloc AS (
    SELECT * FROM scoped_alloc_full WHERE allocated_qty > 0
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
      FROM scoped_alloc_full sa
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
$function$;
