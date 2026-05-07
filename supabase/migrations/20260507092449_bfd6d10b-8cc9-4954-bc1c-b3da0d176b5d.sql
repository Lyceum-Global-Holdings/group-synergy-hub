
CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX IF NOT EXISTS idx_warehouse_items_company_created
  ON public.warehouse_items (company_id, created_at DESC, id DESC);

CREATE INDEX IF NOT EXISTS idx_warehouse_items_name_trgm
  ON public.warehouse_items USING gin (name gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_warehouse_items_item_code_trgm
  ON public.warehouse_items USING gin (item_code gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_warehouse_bin_alloc_item
  ON public.warehouse_bin_allocations (warehouse_item_id);

CREATE OR REPLACE FUNCTION public.list_warehouse_inventory(
  _company_id uuid DEFAULT NULL,
  _search text DEFAULT NULL,
  _category_id uuid DEFAULT NULL,
  _status text DEFAULT NULL,
  _location_ids uuid[] DEFAULT NULL,
  _cursor_created_at timestamptz DEFAULT NULL,
  _cursor_id uuid DEFAULT NULL,
  _limit int DEFAULT 50
)
RETURNS TABLE (
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
SET search_path = public
AS $$
  WITH base AS (
    SELECT wi.*
    FROM public.warehouse_items wi
    WHERE (_company_id IS NULL OR wi.company_id = _company_id)
      AND (_category_id IS NULL OR wi.category_id = _category_id)
      AND (_status IS NULL OR wi.status = _status)
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
    b.current_stock,
    b.available_quantity,
    b.reserved_quantity,
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
      WHERE (_location_ids IS NULL OR wb.location_id = ANY(_location_ids))
    ), '[]'::jsonb) AS bins
  FROM base b
  LEFT JOIN public.item_categories c ON c.id = b.category_id
  LEFT JOIN public.item_units u ON u.id = b.unit_id
  LEFT JOIN public.suppliers s ON s.id = b.supplier_id
  ORDER BY b.created_at DESC, b.id DESC;
$$;

GRANT EXECUTE ON FUNCTION public.list_warehouse_inventory(uuid, text, uuid, text, uuid[], timestamptz, uuid, int) TO authenticated;
