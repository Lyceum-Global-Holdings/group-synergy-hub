-- Speed up list_warehouse_catalog: drop expensive count(*) OVER, use indexed FTS + trigram + ILIKE prefix.
-- Keep signature/columns identical (total_count returned as NULL to preserve shape).

CREATE INDEX IF NOT EXISTS idx_warehouse_item_catalog_status_created
  ON public.warehouse_item_catalog (status, created_at DESC, id DESC);

CREATE INDEX IF NOT EXISTS idx_warehouse_item_catalog_sku_trgm
  ON public.warehouse_item_catalog USING gin (lower(coalesce(sku, '')) extensions.gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_warehouse_item_catalog_barcode_trgm
  ON public.warehouse_item_catalog USING gin (lower(coalesce(barcode, '')) extensions.gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_warehouse_item_catalog_brand_trgm
  ON public.warehouse_item_catalog USING gin (lower(coalesce(brand, '')) extensions.gin_trgm_ops);

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
SET search_path TO 'public', 'extensions'
AS $$
  WITH params AS (
    SELECT NULLIF(btrim(coalesce(_search, '')), '') AS phrase
  ),
  filtered AS (
    SELECT c.*
    FROM public.warehouse_item_catalog c, params p
    WHERE (_status      IS NULL OR c.status      = _status)
      AND (_category_id IS NULL OR c.category_id = _category_id)
      AND (_supplier_id IS NULL OR c.supplier_id = _supplier_id)
      AND (
        p.phrase IS NULL
        OR to_tsvector('simple',
             coalesce(c.item_code,'') || ' ' ||
             coalesce(c.name,'')      || ' ' ||
             coalesce(c.brand,'')     || ' ' ||
             coalesce(c.manufacturer,'') || ' ' ||
             coalesce(c.sku,'')       || ' ' ||
             coalesce(c.barcode,'')
           ) @@ websearch_to_tsquery('simple', p.phrase)
        OR c.item_code ILIKE p.phrase || '%'
        OR c.name      ILIKE '%' || p.phrase || '%'
        OR c.sku       ILIKE p.phrase || '%'
        OR c.barcode   ILIKE p.phrase || '%'
        OR extensions.similarity(lower(coalesce(c.name,'')),      lower(p.phrase)) > 0.3
        OR extensions.similarity(lower(coalesce(c.item_code,'')), lower(p.phrase)) > 0.3
      )
      AND (
        _cursor_created_at IS NULL OR
        c.created_at < _cursor_created_at OR
        (c.created_at = _cursor_created_at AND c.id < _cursor_id)
      )
    ORDER BY c.created_at DESC, c.id DESC
    LIMIT COALESCE(_limit, 50)
  )
  SELECT
    f.id, f.item_code, f.name, f.description,
    f.category_id, cat.name AS category_name,
    f.unit_id,     u.name   AS unit_name,
    f.brand, f.manufacturer,
    f.supplier_id, s.name   AS supplier_name,
    f.barcode, f.sku,
    f.unit_cost, f.selling_price,
    f.reorder_level, f.min_stock_level, f.max_stock_level,
    f.image_url, f.is_serialized, f.is_batch_tracked,
    f.status, f.notes, f.created_at, f.updated_at,
    NULL::bigint AS total_count
  FROM filtered f
  LEFT JOIN public.item_categories cat ON cat.id = f.category_id
  LEFT JOIN public.item_units      u   ON u.id   = f.unit_id
  LEFT JOIN public.suppliers       s   ON s.id   = f.supplier_id
  ORDER BY f.created_at DESC, f.id DESC;
$$;

GRANT EXECUTE ON FUNCTION public.list_warehouse_catalog(text, text, uuid, uuid, timestamptz, uuid, int) TO authenticated;