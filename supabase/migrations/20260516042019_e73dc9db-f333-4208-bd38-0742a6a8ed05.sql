-- Permanent warehouse-scope helper: selecting any location node resolves to
-- the root warehouse and then returns the full root + descendant subtree.
CREATE OR REPLACE FUNCTION public.get_location_subtree_ids(p_location_id uuid)
RETURNS TABLE(location_id uuid)
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  WITH RECURSIVE root AS (
    SELECT public.get_root_location_id(p_location_id) AS id
  ), tree AS (
    SELECT wl.id, wl.parent_id
    FROM public.warehouse_locations wl
    JOIN root r ON r.id = wl.id
    UNION ALL
    SELECT child.id, child.parent_id
    FROM public.warehouse_locations child
    JOIN tree t ON child.parent_id = t.id
  )
  SELECT id AS location_id
  FROM tree
  WHERE id IS NOT NULL;
$$;

-- Thin bin helper for UI/client queries. SECURITY INVOKER is intentional:
-- base-table RLS remains authoritative for the caller.
CREATE OR REPLACE FUNCTION public.get_subtree_bin_ids(p_location_id uuid)
RETURNS TABLE(id uuid)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT wb.id
  FROM public.warehouse_bins wb
  JOIN public.get_location_subtree_ids(p_location_id) scope
    ON scope.location_id = wb.location_id;
$$;

-- Location-scoped inventory now uses the warehouse subtree instead of exact
-- location equality. This matches SAP EWM / WMS roll-up semantics where the
-- main warehouse and its sub-locations share the same bin stock picture.
CREATE OR REPLACE FUNCTION public.get_company_inventory_at_location(p_company_id uuid, p_location_id uuid)
RETURNS SETOF public.warehouse_items
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  scope_ids uuid[];
BEGIN
  IF p_company_id IS NULL OR p_location_id IS NULL THEN
    RETURN;
  END IF;

  IF NOT public.can_access_company(p_company_id) THEN
    RETURN;
  END IF;

  -- Verify the company has effective access to the selected location node.
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

  IF scope_ids IS NULL OR cardinality(scope_ids) = 0 THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT DISTINCT ON (wi.created_at, wi.id) wi.*
  FROM public.warehouse_items wi
  WHERE wi.company_id = p_company_id
    AND COALESCE(wi.current_stock, 0) > 0
    AND (
      wi.location_id = ANY(scope_ids)
      OR EXISTS (
        SELECT 1
        FROM public.warehouse_bin_allocations wba
        JOIN public.warehouse_bins wb ON wb.id = wba.bin_id
        WHERE wba.warehouse_item_id = wi.id
          AND wb.location_id = ANY(scope_ids)
          AND wba.available_quantity > 0
      )
    )
  ORDER BY wi.created_at DESC, wi.id DESC;
END;
$$;

-- Server-paginated inventory list: expand any caller-provided location IDs to
-- their warehouse subtree before filtering the bin JSON. Other filters and the
-- keyset cursor remain unchanged.
CREATE OR REPLACE FUNCTION public.list_warehouse_inventory(
  _company_id uuid DEFAULT NULL::uuid,
  _search text DEFAULT NULL::text,
  _category_id uuid DEFAULT NULL::uuid,
  _status text DEFAULT NULL::text,
  _location_ids uuid[] DEFAULT NULL::uuid[],
  _cursor_created_at timestamp with time zone DEFAULT NULL::timestamp with time zone,
  _cursor_id uuid DEFAULT NULL::uuid,
  _limit integer DEFAULT 50,
  _stock_mode text DEFAULT NULL::text
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
  created_at timestamp with time zone,
  updated_at timestamp with time zone,
  bins jsonb
)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  WITH scope AS (
    SELECT DISTINCT s.location_id
    FROM unnest(COALESCE(_location_ids, ARRAY[]::uuid[])) AS requested(location_id)
    CROSS JOIN LATERAL public.get_location_subtree_ids(requested.location_id) s
  ), base AS (
    SELECT wi.*
    FROM public.warehouse_items wi
    WHERE (_company_id IS NULL OR wi.company_id = _company_id)
      AND (_category_id IS NULL OR wi.category_id = _category_id)
      AND (_status IS NULL OR wi.status = _status)
      AND (
        _stock_mode IS NULL
        OR (_stock_mode = 'in_stock' AND COALESCE(wi.current_stock, 0) > 0)
        OR (_stock_mode = 'zero'     AND COALESCE(wi.current_stock, 0) = 0)
        OR (_stock_mode = 'low'      AND COALESCE(wi.current_stock, 0) <= COALESCE(wi.reorder_level, 0))
      )
      AND (
        _search IS NULL OR _search = ''
        OR wi.name ILIKE '%' || _search || '%'
        OR wi.item_code ILIKE '%' || _search || '%'
        OR COALESCE(wi.sku,'') ILIKE '%' || _search || '%'
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
    b.id, b.item_code, b.name, b.description,
    b.category_id, c.name AS category_name,
    b.unit_id, u.name AS unit_name, u.abbreviation AS unit_abbreviation,
    b.brand, b.manufacturer,
    b.supplier_id, s.name AS supplier_name,
    b.status, b.current_stock, b.available_quantity, b.reserved_quantity,
    b.unit_cost, b.selling_price,
    b.reorder_level, b.min_stock_level, b.max_stock_level,
    b.image_url, b.company_id, b.created_at, b.updated_at,
    COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', wb.id,
        'bin_code', wb.bin_code,
        'name', wb.name,
        'quantity', alloc.qty
      ) ORDER BY wb.bin_code)
      FROM (
        SELECT a.bin_id, SUM(a.available_quantity) AS qty
        FROM public.warehouse_bin_allocations a
        WHERE a.warehouse_item_id = b.id
          AND a.available_quantity > 0
        GROUP BY a.bin_id
      ) alloc
      JOIN public.warehouse_bins wb ON wb.id = alloc.bin_id
      WHERE (
        _location_ids IS NULL
        OR EXISTS (SELECT 1 FROM scope WHERE scope.location_id = wb.location_id)
      )
    ), '[]'::jsonb) AS bins
  FROM base b
  LEFT JOIN public.item_categories c ON c.id = b.category_id
  LEFT JOIN public.item_units u ON u.id = b.unit_id
  LEFT JOIN public.suppliers s ON s.id = b.supplier_id
  ORDER BY b.created_at DESC, b.id DESC;
$$;