-- Phase 8: Reliable keyset pagination for warehouse_item_catalog
-- Fixes silent row-dropping caused by non-monotonic UUID tiebreaker on
-- the 13,899-row bulk-import bucket sharing one created_at.

CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Indexes ---------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_warehouse_catalog_keyset
  ON public.warehouse_item_catalog (created_at DESC, item_code DESC, id DESC);

CREATE INDEX IF NOT EXISTS idx_warehouse_catalog_status_keyset
  ON public.warehouse_item_catalog (status, created_at DESC, item_code DESC, id DESC);

CREATE INDEX IF NOT EXISTS idx_warehouse_catalog_name_trgm
  ON public.warehouse_item_catalog USING gin (lower(name) gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_warehouse_catalog_code_trgm
  ON public.warehouse_item_catalog USING gin (lower(item_code) gin_trgm_ops);

-- Page RPC --------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_warehouse_catalog_page(
  p_search          text        DEFAULT NULL,
  p_category_id     uuid        DEFAULT NULL,
  p_status          text        DEFAULT NULL,
  p_supplier_id     uuid        DEFAULT NULL,
  p_cursor_created  timestamptz DEFAULT NULL,
  p_cursor_code     text        DEFAULT NULL,
  p_cursor_id       uuid        DEFAULT NULL,
  p_limit           int         DEFAULT 100
)
RETURNS TABLE (
  id uuid,
  item_code text,
  name text,
  description text,
  category_id uuid,
  unit_id uuid,
  brand text,
  barcode text,
  sku text,
  unit_cost numeric,
  selling_price numeric,
  reorder_level numeric,
  status text,
  image_url text,
  supplier_id uuid,
  supplier_name text,
  created_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  WITH params AS (
    SELECT
      CASE WHEN p_search IS NULL OR btrim(p_search) = '' THEN NULL
           ELSE '%' || lower(btrim(p_search)) || '%' END AS search_pat
  )
  SELECT
    c.id,
    c.item_code,
    c.name,
    c.description,
    c.category_id,
    c.unit_id,
    c.brand,
    c.barcode,
    c.sku,
    c.unit_cost,
    c.selling_price,
    c.reorder_level,
    c.status,
    c.image_url,
    c.supplier_id,
    s.name AS supplier_name,
    c.created_at
  FROM public.warehouse_item_catalog c
  LEFT JOIN public.suppliers s ON s.id = c.supplier_id
  CROSS JOIN params
  WHERE
    (p_category_id IS NULL OR c.category_id = p_category_id)
    AND (p_status IS NULL OR c.status = p_status)
    AND (p_supplier_id IS NULL OR c.supplier_id = p_supplier_id)
    AND (
      params.search_pat IS NULL
      OR lower(c.name)      LIKE params.search_pat
      OR lower(c.item_code) LIKE params.search_pat
      OR lower(c.brand)     LIKE params.search_pat
      OR lower(c.barcode)   LIKE params.search_pat
      OR lower(c.sku)       LIKE params.search_pat
    )
    AND (
      p_cursor_created IS NULL
      OR c.created_at < p_cursor_created
      OR (c.created_at = p_cursor_created AND c.item_code < p_cursor_code)
      OR (c.created_at = p_cursor_created AND c.item_code = p_cursor_code AND c.id < p_cursor_id)
    )
  ORDER BY c.created_at DESC, c.item_code DESC, c.id DESC
  LIMIT COALESCE(p_limit, 100);
$$;

GRANT EXECUTE ON FUNCTION public.get_warehouse_catalog_page(
  text, uuid, text, uuid, timestamptz, text, uuid, int
) TO authenticated;

-- Count RPC -------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_warehouse_catalog_count(
  p_search       text DEFAULT NULL,
  p_category_id  uuid DEFAULT NULL,
  p_status       text DEFAULT NULL,
  p_supplier_id  uuid DEFAULT NULL
)
RETURNS bigint
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  WITH params AS (
    SELECT
      CASE WHEN p_search IS NULL OR btrim(p_search) = '' THEN NULL
           ELSE '%' || lower(btrim(p_search)) || '%' END AS search_pat
  )
  SELECT COUNT(*)::bigint
  FROM public.warehouse_item_catalog c
  CROSS JOIN params
  WHERE
    (p_category_id IS NULL OR c.category_id = p_category_id)
    AND (p_status IS NULL OR c.status = p_status)
    AND (p_supplier_id IS NULL OR c.supplier_id = p_supplier_id)
    AND (
      params.search_pat IS NULL
      OR lower(c.name)      LIKE params.search_pat
      OR lower(c.item_code) LIKE params.search_pat
      OR lower(c.brand)     LIKE params.search_pat
      OR lower(c.barcode)   LIKE params.search_pat
      OR lower(c.sku)       LIKE params.search_pat
    );
$$;

GRANT EXECUTE ON FUNCTION public.get_warehouse_catalog_count(
  text, uuid, text, uuid
) TO authenticated;