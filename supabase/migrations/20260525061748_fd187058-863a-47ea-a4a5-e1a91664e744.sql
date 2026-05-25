CREATE INDEX IF NOT EXISTS warehouse_item_catalog_fts_idx
  ON public.warehouse_item_catalog USING GIN (
    to_tsvector(
      'simple',
      coalesce(item_code, '') || ' ' ||
      coalesce(name, '')      || ' ' ||
      coalesce(brand, '')     || ' ' ||
      coalesce(sku, '')       || ' ' ||
      coalesce(barcode, '')
    )
  );

CREATE INDEX IF NOT EXISTS warehouse_item_catalog_name_trgm_idx
  ON public.warehouse_item_catalog USING GIN (name extensions.gin_trgm_ops);

CREATE INDEX IF NOT EXISTS warehouse_item_catalog_code_trgm_idx
  ON public.warehouse_item_catalog USING GIN (item_code extensions.gin_trgm_ops);

CREATE OR REPLACE FUNCTION public.search_warehouse_item_catalog(
  p_query text DEFAULT NULL,
  p_limit int DEFAULT 25
)
RETURNS TABLE(
  id uuid,
  item_code text,
  name text,
  brand text,
  category_name text,
  unit_name text,
  status text,
  rank real
)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path TO 'public', 'extensions'
AS $function$
  WITH q AS (
    SELECT
      nullif(btrim(coalesce(p_query, '')), '')               AS raw,
      websearch_to_tsquery('simple', coalesce(p_query, ''))  AS tsq
  ),
  base AS (
    SELECT
      c.id,
      c.item_code,
      c.name,
      c.brand,
      ic.name AS category_name,
      iu.name AS unit_name,
      c.status,
      to_tsvector(
        'simple',
        coalesce(c.item_code, '') || ' ' ||
        coalesce(c.name, '')      || ' ' ||
        coalesce(c.brand, '')     || ' ' ||
        coalesce(c.sku, '')       || ' ' ||
        coalesce(c.barcode, '')
      ) AS tsv
    FROM public.warehouse_item_catalog c
    LEFT JOIN public.item_categories ic ON ic.id = c.category_id
    LEFT JOIN public.item_units      iu ON iu.id = c.unit_id
    WHERE coalesce(c.status, 'active') = 'active'
  ),
  scored AS (
    SELECT
      b.*,
      CASE WHEN (SELECT raw FROM q) IS NULL THEN 0.0::real
           WHEN lower(b.item_code) = lower((SELECT raw FROM q)) THEN 1000.0::real
           WHEN b.item_code ILIKE (SELECT raw FROM q) || '%'    THEN 500.0::real
           WHEN b.name      ILIKE (SELECT raw FROM q) || '%'    THEN 300.0::real
           ELSE 0.0::real
      END
      +
      CASE WHEN (SELECT raw FROM q) IS NULL THEN 0.0::real
           ELSE 100.0 * ts_rank_cd(b.tsv, (SELECT tsq FROM q))
      END
      +
      CASE WHEN (SELECT raw FROM q) IS NULL THEN 0.0::real
           ELSE 10.0 * GREATEST(
             extensions.similarity(coalesce(b.name, ''),      (SELECT raw FROM q)),
             extensions.similarity(coalesce(b.item_code, ''), (SELECT raw FROM q))
           )
      END AS rank
    FROM base b
  )
  SELECT
    id, item_code, name, brand, category_name, unit_name, status, rank
  FROM scored
  WHERE
    (SELECT raw FROM q) IS NULL
    OR rank > 0.05
    OR tsv @@ (SELECT tsq FROM q)
  ORDER BY
    rank DESC,
    item_code ASC
  LIMIT GREATEST(1, LEAST(coalesce(p_limit, 25), 100));
$function$;

GRANT EXECUTE ON FUNCTION public.search_warehouse_item_catalog(text, int) TO authenticated;