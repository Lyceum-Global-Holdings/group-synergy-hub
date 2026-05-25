CREATE EXTENSION IF NOT EXISTS pg_trgm WITH SCHEMA extensions;

CREATE INDEX IF NOT EXISTS idx_wic_fts
  ON public.warehouse_item_catalog USING gin (
    to_tsvector('simple',
      coalesce(item_code,'')    || ' ' ||
      coalesce(name,'')         || ' ' ||
      coalesce(brand,'')        || ' ' ||
      coalesce(manufacturer,'') || ' ' ||
      coalesce(sku,'')          || ' ' ||
      coalesce(barcode,'')      || ' ' ||
      coalesce(description,'')
    )
  );

CREATE INDEX IF NOT EXISTS idx_wic_name_lower_trgm
  ON public.warehouse_item_catalog USING gin (lower(coalesce(name,'')) extensions.gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_wic_item_code_lower_trgm
  ON public.warehouse_item_catalog USING gin (lower(coalesce(item_code,'')) extensions.gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_wic_manufacturer_lower_trgm
  ON public.warehouse_item_catalog USING gin (lower(coalesce(manufacturer,'')) extensions.gin_trgm_ops);

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
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path TO 'public', 'extensions'
AS $$
DECLARE
  v_phrase    text := nullif(btrim(coalesce(_search, '')), '');
  v_phrase_lc text;
  v_like      text;
  v_tsq       tsquery;
  v_limit     int := COALESCE(_limit, 50);
BEGIN
  IF v_phrase IS NULL THEN
    RETURN QUERY
    SELECT
      c.id, c.item_code, c.name, c.description,
      c.category_id, cat.name,
      c.unit_id,     u.name,
      c.brand, c.manufacturer,
      c.supplier_id, s.name,
      c.barcode, c.sku,
      c.unit_cost, c.selling_price,
      c.reorder_level, c.min_stock_level, c.max_stock_level,
      c.image_url, c.is_serialized, c.is_batch_tracked,
      c.status, c.notes, c.created_at, c.updated_at,
      NULL::bigint
    FROM public.warehouse_item_catalog c
    LEFT JOIN public.item_categories cat ON cat.id = c.category_id
    LEFT JOIN public.item_units      u   ON u.id   = c.unit_id
    LEFT JOIN public.suppliers       s   ON s.id   = c.supplier_id
    WHERE (_status      IS NULL OR c.status      = _status)
      AND (_category_id IS NULL OR c.category_id = _category_id)
      AND (_supplier_id IS NULL OR c.supplier_id = _supplier_id)
      AND (
        _cursor_created_at IS NULL OR
        c.created_at < _cursor_created_at OR
        (c.created_at = _cursor_created_at AND c.id < _cursor_id)
      )
    ORDER BY c.created_at DESC, c.id DESC
    LIMIT v_limit;
    RETURN;
  END IF;

  v_phrase_lc := lower(v_phrase);
  v_like := '%' || replace(replace(replace(v_phrase_lc, '\', '\\'), '%', '\%'), '_', '\_') || '%';

  BEGIN
    v_tsq := websearch_to_tsquery('simple', v_phrase);
  EXCEPTION WHEN OTHERS THEN
    v_tsq := NULL;
  END;

  RETURN QUERY
  WITH candidates AS (
    (
      SELECT c.id, 1000 AS prio
      FROM public.warehouse_item_catalog c
      WHERE lower(c.item_code) = v_phrase_lc
        AND (_status IS NULL OR c.status = _status)
        AND (_category_id IS NULL OR c.category_id = _category_id)
        AND (_supplier_id IS NULL OR c.supplier_id = _supplier_id)
      LIMIT 50
    )
    UNION ALL
    (
      SELECT c.id, 900 AS prio
      FROM public.warehouse_item_catalog c
      WHERE lower(c.item_code) LIKE v_like ESCAPE '\'
        AND (_status IS NULL OR c.status = _status)
        AND (_category_id IS NULL OR c.category_id = _category_id)
        AND (_supplier_id IS NULL OR c.supplier_id = _supplier_id)
      LIMIT 200
    )
    UNION ALL
    (
      SELECT c.id, 800 AS prio
      FROM public.warehouse_item_catalog c
      WHERE lower(coalesce(c.name,'')) LIKE v_like ESCAPE '\'
        AND (_status IS NULL OR c.status = _status)
        AND (_category_id IS NULL OR c.category_id = _category_id)
        AND (_supplier_id IS NULL OR c.supplier_id = _supplier_id)
      LIMIT 500
    )
    UNION ALL
    (
      SELECT c.id, 700 AS prio
      FROM public.warehouse_item_catalog c
      WHERE lower(coalesce(c.sku,'')) LIKE v_like ESCAPE '\'
        AND (_status IS NULL OR c.status = _status)
        AND (_category_id IS NULL OR c.category_id = _category_id)
        AND (_supplier_id IS NULL OR c.supplier_id = _supplier_id)
      LIMIT 100
    )
    UNION ALL
    (
      SELECT c.id, 700 AS prio
      FROM public.warehouse_item_catalog c
      WHERE lower(coalesce(c.barcode,'')) LIKE v_like ESCAPE '\'
        AND (_status IS NULL OR c.status = _status)
        AND (_category_id IS NULL OR c.category_id = _category_id)
        AND (_supplier_id IS NULL OR c.supplier_id = _supplier_id)
      LIMIT 100
    )
    UNION ALL
    (
      SELECT c.id, 600 AS prio
      FROM public.warehouse_item_catalog c
      WHERE lower(coalesce(c.brand,'')) LIKE v_like ESCAPE '\'
        AND (_status IS NULL OR c.status = _status)
        AND (_category_id IS NULL OR c.category_id = _category_id)
        AND (_supplier_id IS NULL OR c.supplier_id = _supplier_id)
      LIMIT 100
    )
    UNION ALL
    (
      SELECT c.id, 600 AS prio
      FROM public.warehouse_item_catalog c
      WHERE lower(coalesce(c.manufacturer,'')) LIKE v_like ESCAPE '\'
        AND (_status IS NULL OR c.status = _status)
        AND (_category_id IS NULL OR c.category_id = _category_id)
        AND (_supplier_id IS NULL OR c.supplier_id = _supplier_id)
      LIMIT 100
    )
    UNION ALL
    (
      SELECT c.id, 500 AS prio
      FROM public.warehouse_item_catalog c
      WHERE v_tsq IS NOT NULL
        AND to_tsvector('simple',
              coalesce(c.item_code,'')    || ' ' ||
              coalesce(c.name,'')         || ' ' ||
              coalesce(c.brand,'')        || ' ' ||
              coalesce(c.manufacturer,'') || ' ' ||
              coalesce(c.sku,'')          || ' ' ||
              coalesce(c.barcode,'')      || ' ' ||
              coalesce(c.description,'')
            ) @@ v_tsq
        AND (_status IS NULL OR c.status = _status)
        AND (_category_id IS NULL OR c.category_id = _category_id)
        AND (_supplier_id IS NULL OR c.supplier_id = _supplier_id)
      LIMIT 500
    )
  ),
  dedup AS (
    SELECT id, MAX(prio) AS prio FROM candidates GROUP BY id
  ),
  ranked AS (
    SELECT
      c.*,
      d.prio,
      extensions.similarity(lower(coalesce(c.name,'')), v_phrase_lc) AS name_sim
    FROM dedup d
    JOIN public.warehouse_item_catalog c ON c.id = d.id
    WHERE (
      _cursor_created_at IS NULL OR
      c.created_at < _cursor_created_at OR
      (c.created_at = _cursor_created_at AND c.id < _cursor_id)
    )
  )
  SELECT
    r.id, r.item_code, r.name, r.description,
    r.category_id, cat.name,
    r.unit_id,     u.name,
    r.brand, r.manufacturer,
    r.supplier_id, s.name,
    r.barcode, r.sku,
    r.unit_cost, r.selling_price,
    r.reorder_level, r.min_stock_level, r.max_stock_level,
    r.image_url, r.is_serialized, r.is_batch_tracked,
    r.status, r.notes, r.created_at, r.updated_at,
    NULL::bigint
  FROM ranked r
  LEFT JOIN public.item_categories cat ON cat.id = r.category_id
  LEFT JOIN public.item_units      u   ON u.id   = r.unit_id
  LEFT JOIN public.suppliers       s   ON s.id   = r.supplier_id
  ORDER BY r.prio DESC, r.name_sim DESC NULLS LAST, r.created_at DESC, r.id DESC
  LIMIT v_limit;
END;
$$;

GRANT EXECUTE ON FUNCTION public.list_warehouse_catalog(text, text, uuid, uuid, timestamptz, uuid, int) TO authenticated;