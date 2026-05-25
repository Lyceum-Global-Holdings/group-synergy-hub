CREATE OR REPLACE FUNCTION public.list_warehouse_catalog(
  _search text DEFAULT NULL::text,
  _status text DEFAULT NULL::text,
  _category_id uuid DEFAULT NULL::uuid,
  _supplier_id uuid DEFAULT NULL::uuid,
  _cursor_created_at timestamp with time zone DEFAULT NULL::timestamp with time zone,
  _cursor_id uuid DEFAULT NULL::uuid,
  _limit integer DEFAULT 50
)
RETURNS TABLE(
  id uuid, item_code text, name text, description text,
  category_id uuid, category_name text,
  unit_id uuid, unit_name text,
  brand text, manufacturer text,
  supplier_id uuid, supplier_name text,
  barcode text, sku text,
  unit_cost numeric, selling_price numeric,
  reorder_level numeric, min_stock_level numeric, max_stock_level numeric,
  image_url text, is_serialized boolean, is_batch_tracked boolean,
  status text, notes text,
  created_at timestamp with time zone, updated_at timestamp with time zone,
  total_count bigint
)
LANGUAGE sql
STABLE
SET search_path TO 'public'
AS $function$
  WITH tokens AS (
    SELECT
      -- Escape LIKE wildcards in each token so user input is treated literally
      replace(replace(replace(tok, '\', '\\'), '%', '\%'), '_', '\_') AS tok
    FROM unnest(
      string_to_array(
        regexp_replace(coalesce(trim(_search), ''), '\s+', ' ', 'g'),
        ' '
      )
    ) AS s(tok)
    WHERE tok IS NOT NULL AND tok <> ''
  ),
  filtered AS (
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
        NOT EXISTS (SELECT 1 FROM tokens)
        OR NOT EXISTS (
          SELECT 1 FROM tokens t
          WHERE NOT (
            c.item_code    ILIKE '%' || t.tok || '%' ESCAPE '\' OR
            c.name         ILIKE '%' || t.tok || '%' ESCAPE '\' OR
            c.sku          ILIKE '%' || t.tok || '%' ESCAPE '\' OR
            c.barcode      ILIKE '%' || t.tok || '%' ESCAPE '\' OR
            c.brand        ILIKE '%' || t.tok || '%' ESCAPE '\' OR
            c.manufacturer ILIKE '%' || t.tok || '%' ESCAPE '\'
          )
        )
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
$function$;