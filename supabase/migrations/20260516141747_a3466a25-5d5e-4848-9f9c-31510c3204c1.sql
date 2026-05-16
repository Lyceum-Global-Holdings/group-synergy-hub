
DROP FUNCTION IF EXISTS public.list_warehouse_catalog(text, text, uuid, uuid, timestamptz, uuid, int);

CREATE OR REPLACE FUNCTION public.list_warehouse_catalog(
  _search             text         DEFAULT NULL,
  _status             text         DEFAULT NULL,
  _category_id        uuid         DEFAULT NULL,
  _supplier_id        uuid         DEFAULT NULL,
  _cursor_created_at  timestamptz  DEFAULT NULL,
  _cursor_id          uuid         DEFAULT NULL,
  _limit              int          DEFAULT 50
)
RETURNS TABLE (
  id               uuid,
  item_code        text,
  name             text,
  description      text,
  category_id      uuid,
  category_name    text,
  unit_id          uuid,
  unit_name        text,
  brand            text,
  manufacturer     text,
  supplier_id      uuid,
  supplier_name    text,
  barcode          text,
  sku              text,
  unit_cost        numeric,
  selling_price    numeric,
  reorder_level    numeric,
  min_stock_level  numeric,
  max_stock_level  numeric,
  image_url        text,
  is_serialized    boolean,
  is_batch_tracked boolean,
  status           text,
  notes            text,
  created_at       timestamptz,
  updated_at       timestamptz,
  total_count      bigint
)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  WITH filtered AS (
    SELECT
      c.*,
      cat.name AS _category_name,
      u.name   AS _unit_name,
      s.name   AS _supplier_name,
      count(*) OVER () AS _total
    FROM public.warehouse_item_catalog c
    LEFT JOIN public.item_categories cat ON cat.id = c.category_id
    LEFT JOIN public.item_units u        ON u.id   = c.unit_id
    LEFT JOIN public.suppliers s         ON s.id   = c.supplier_id
    WHERE
      (_status      IS NULL OR c.status      = _status)
      AND (_category_id IS NULL OR c.category_id = _category_id)
      AND (_supplier_id IS NULL OR c.supplier_id = _supplier_id)
      AND (
        _search IS NULL OR _search = '' OR
        c.item_code ILIKE '%' || _search || '%' OR
        c.name      ILIKE '%' || _search || '%' OR
        c.sku       ILIKE '%' || _search || '%' OR
        c.barcode   ILIKE '%' || _search || '%'
      )
      AND (
        _cursor_created_at IS NULL OR
        c.created_at < _cursor_created_at OR
        (c.created_at = _cursor_created_at AND c.id < _cursor_id)
      )
  )
  SELECT
    id, item_code, name, description,
    category_id, _category_name AS category_name,
    unit_id,     _unit_name     AS unit_name,
    brand, manufacturer,
    supplier_id, _supplier_name AS supplier_name,
    barcode, sku,
    unit_cost, selling_price,
    reorder_level, min_stock_level, max_stock_level,
    image_url, is_serialized, is_batch_tracked,
    status, notes, created_at, updated_at,
    _total AS total_count
  FROM filtered
  ORDER BY created_at DESC, id DESC
  LIMIT COALESCE(_limit, 50);
$$;

REVOKE ALL ON FUNCTION public.list_warehouse_catalog(text, text, uuid, uuid, timestamptz, uuid, int) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.list_warehouse_catalog(text, text, uuid, uuid, timestamptz, uuid, int) TO authenticated;

CREATE INDEX IF NOT EXISTS idx_warehouse_item_catalog_created_at_id
  ON public.warehouse_item_catalog (created_at DESC, id DESC);
