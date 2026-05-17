CREATE OR REPLACE FUNCTION public.list_warehouse_inventory(
  _company_id uuid DEFAULT NULL::uuid,
  _search text DEFAULT NULL::text,
  _category_id uuid DEFAULT NULL::uuid,
  _status text DEFAULT NULL::text,
  _location_ids uuid[] DEFAULT NULL::uuid[],
  _cursor_created_at timestamp with time zone DEFAULT NULL::timestamp with time zone,
  _cursor_id uuid DEFAULT NULL::uuid,
  _limit integer DEFAULT 50,
  _stock_mode text DEFAULT NULL::text,
  _supplier_id uuid DEFAULT NULL::uuid
)
RETURNS TABLE(
  id uuid, item_code text, name text, description text,
  category_id uuid, category_name text,
  unit_id uuid, unit_name text, unit_abbreviation text,
  brand text, manufacturer text,
  supplier_id uuid, supplier_name text,
  status text,
  current_stock numeric, available_quantity numeric, reserved_quantity numeric,
  unit_cost numeric, selling_price numeric,
  reorder_level numeric, min_stock_level numeric, max_stock_level numeric,
  image_url text,
  company_id uuid,
  created_at timestamp with time zone,
  updated_at timestamp with time zone,
  bins jsonb
)
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
  ), base AS (
    SELECT
      wi.id,
      wi.company_id,
      wi.status,
      wi.unit_cost,
      wi.selling_price,
      wi.reorder_level,
      wi.min_stock_level,
      wi.max_stock_level,
      wi.created_at,
      wi.updated_at,
      wi.location_id      AS wi_location_id,
      wi.current_stock    AS wi_current_stock,
      wi.available_quantity AS wi_available_quantity,
      wi.reserved_quantity  AS wi_reserved_quantity,
      cat.item_code   AS m_item_code,
      cat.name        AS m_name,
      cat.description AS m_description,
      cat.category_id AS m_category_id,
      cat.unit_id     AS m_unit_id,
      cat.brand       AS m_brand,
      cat.manufacturer AS m_manufacturer,
      cat.supplier_id AS m_supplier_id,
      cat.image_url   AS m_image_url
    FROM public.warehouse_items wi
    JOIN public.warehouse_item_catalog cat ON cat.id = wi.catalog_item_id
    WHERE (_company_id IS NULL OR wi.company_id = _company_id)
      AND (_category_id IS NULL OR cat.category_id = _category_id)
      AND (_supplier_id IS NULL OR cat.supplier_id = _supplier_id)
      AND (_status IS NULL OR wi.status = _status)
      AND (
        _search IS NULL OR _search = ''
        OR cat.name ILIKE '%' || _search || '%'
        OR cat.item_code ILIKE '%' || _search || '%'
        OR COALESCE(cat.brand,'') ILIKE '%' || _search || '%'
        OR COALESCE(cat.barcode,'') ILIKE '%' || _search || '%'
        OR COALESCE(cat.sku,'') ILIKE '%' || _search || '%'
      )
      AND (
        _cursor_created_at IS NULL
        OR wi.created_at < _cursor_created_at
        OR (wi.created_at = _cursor_created_at AND wi.id < _cursor_id)
      )
    ORDER BY wi.created_at DESC, wi.id DESC
    LIMIT GREATEST(_limit, 1) * 4  -- overfetch so stock_mode filter still returns a full page
  ), scoped AS (
    SELECT
      b.*,
      hs.value AS has_scope,
      st.allocated_qty,
      st.available_qty,
      st.reserved_qty,
      bn.bins
    FROM base b
    CROSS JOIN has_scope hs
    LEFT JOIN LATERAL (
      SELECT
        SUM(a.allocated_quantity) AS allocated_qty,
        SUM(a.available_quantity) AS available_qty,
        SUM(a.reserved_quantity)  AS reserved_qty
      FROM public.warehouse_bin_allocations a
      JOIN public.warehouse_bins wb ON wb.id = a.bin_id
      WHERE a.warehouse_item_id = b.id
        AND (_company_id IS NULL OR a.company_id = _company_id)
        AND (
          hs.value = false
          OR wb.location_id IN (SELECT location_id FROM distinct_scope)
        )
    ) st ON TRUE
    LEFT JOIN LATERAL (
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
      ) ORDER BY wl.name NULLS LAST, wb.bin_code) AS bins
      FROM (
        SELECT
          a.bin_id,
          wb2.location_id AS stock_location_id,
          SUM(a.available_quantity) AS available_qty,
          SUM(a.allocated_quantity) AS allocated_qty,
          SUM(a.reserved_quantity)  AS reserved_qty
        FROM public.warehouse_bin_allocations a
        JOIN public.warehouse_bins wb2 ON wb2.id = a.bin_id
        WHERE a.warehouse_item_id = b.id
          AND a.allocated_quantity > 0
          AND (_company_id IS NULL OR a.company_id = _company_id)
          AND (
            hs.value = false
            OR wb2.location_id IN (SELECT location_id FROM distinct_scope)
          )
        GROUP BY a.bin_id, wb2.location_id
      ) sa
      JOIN public.warehouse_bins wb ON wb.id = sa.bin_id
      LEFT JOIN public.warehouse_locations wl ON wl.id = sa.stock_location_id
    ) bn ON TRUE
  ), filtered AS (
    SELECT *
    FROM scoped s
    WHERE (
      -- When a scope is requested, only show items with stock in that scope
      -- (or zero-stock items physically located there when caller asks for them).
      s.has_scope = false
      OR COALESCE(s.allocated_qty, 0) > 0
      OR (
        _stock_mode = 'zero'
        AND s.wi_location_id IN (SELECT location_id FROM distinct_scope)
        AND COALESCE(s.allocated_qty, 0) = 0
      )
    )
    AND (
      _stock_mode IS NULL OR _stock_mode = 'all'
      OR (_stock_mode = 'in_stock'
          AND COALESCE(CASE WHEN s.has_scope THEN s.allocated_qty ELSE s.wi_current_stock END, 0) > 0)
      OR (_stock_mode = 'zero'
          AND COALESCE(CASE WHEN s.has_scope THEN s.allocated_qty ELSE s.wi_current_stock END, 0) = 0)
      OR (_stock_mode = 'low'
          AND COALESCE(CASE WHEN s.has_scope THEN s.allocated_qty ELSE s.wi_current_stock END, 0) > 0
          AND COALESCE(CASE WHEN s.has_scope THEN s.allocated_qty ELSE s.wi_current_stock END, 0) <= COALESCE(s.reorder_level, 0))
    )
    ORDER BY s.created_at DESC, s.id DESC
    LIMIT GREATEST(_limit, 1)
  )
  SELECT
    f.id,
    f.m_item_code,
    f.m_name,
    f.m_description,
    f.m_category_id,
    c.name AS category_name,
    f.m_unit_id,
    u.name AS unit_name,
    u.abbreviation AS unit_abbreviation,
    f.m_brand,
    f.m_manufacturer,
    f.m_supplier_id,
    sup.name AS supplier_name,
    f.status,
    COALESCE(CASE WHEN f.has_scope THEN f.allocated_qty ELSE f.wi_current_stock END, 0) AS current_stock,
    COALESCE(CASE WHEN f.has_scope THEN f.available_qty ELSE f.wi_available_quantity END, 0) AS available_quantity,
    COALESCE(CASE WHEN f.has_scope THEN f.reserved_qty  ELSE f.wi_reserved_quantity  END, 0) AS reserved_quantity,
    f.unit_cost,
    f.selling_price,
    f.reorder_level,
    f.min_stock_level,
    f.max_stock_level,
    f.m_image_url,
    f.company_id,
    f.created_at,
    f.updated_at,
    COALESCE(f.bins, '[]'::jsonb) AS bins
  FROM filtered f
  LEFT JOIN public.item_categories c ON c.id = f.m_category_id
  LEFT JOIN public.item_units u ON u.id = f.m_unit_id
  LEFT JOIN public.suppliers sup ON sup.id = f.m_supplier_id
  ORDER BY f.created_at DESC, f.id DESC;
$function$;

GRANT EXECUTE ON FUNCTION public.list_warehouse_inventory(uuid, text, uuid, text, uuid[], timestamptz, uuid, integer, text, uuid)
  TO anon, authenticated, service_role;