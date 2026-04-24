-- ============================================================================
-- Phase 9: Tool import visibility — catalog-based source of truth
-- ============================================================================

-- 1) Provenance: link warehouse_tools back to the catalog row it was promoted from
ALTER TABLE public.warehouse_tools
  ADD COLUMN IF NOT EXISTS catalog_item_id uuid
    REFERENCES public.warehouse_item_catalog(id) ON DELETE SET NULL;

-- Partial unique index: prevent double-import of the same catalog item per company
CREATE UNIQUE INDEX IF NOT EXISTS warehouse_tools_company_catalog_uniq
  ON public.warehouse_tools (company_id, catalog_item_id)
  WHERE catalog_item_id IS NOT NULL;

-- 2) Picker hot-path indexes on the global catalog
CREATE INDEX IF NOT EXISTS idx_warehouse_item_catalog_status_name
  ON public.warehouse_item_catalog (status, name);

CREATE INDEX IF NOT EXISTS idx_warehouse_item_catalog_category
  ON public.warehouse_item_catalog (category_id) WHERE status = 'active';

-- Trigram extension + indexes for fast ILIKE search at 14k+ rows
CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX IF NOT EXISTS idx_warehouse_item_catalog_name_trgm
  ON public.warehouse_item_catalog USING gin (lower(name) gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_warehouse_item_catalog_code_trgm
  ON public.warehouse_item_catalog USING gin (lower(item_code) gin_trgm_ops);

-- 3) Catalog-based candidate RPC
-- Reads from warehouse_item_catalog (master data) — never from warehouse_items.
-- Joins a NON-FILTERING inventory snapshot for the target company/location
-- (suggested initial qty only — never excludes catalog rows).
CREATE OR REPLACE FUNCTION public.get_tool_catalog_candidates(
  p_search                 text     DEFAULT NULL,
  p_category_ids           uuid[]   DEFAULT NULL,
  p_include_all_categories boolean  DEFAULT false,
  p_target_company_id      uuid     DEFAULT NULL,
  p_target_location_id     uuid     DEFAULT NULL,
  p_limit                  int      DEFAULT 20000
)
RETURNS TABLE (
  id                  uuid,
  item_code           text,
  name                text,
  description         text,
  category_id         uuid,
  unit_id             uuid,
  unit_cost           numeric,
  image_url           text,
  status              text,
  category_name       text,
  category_code       text,
  unit_abbreviation   text,
  inventory_item_id   uuid,
  current_stock       numeric,
  inventory_location_id uuid
)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT
    c.id,
    c.item_code,
    c.name,
    c.description,
    c.category_id,
    c.unit_id,
    c.unit_cost,
    c.image_url,
    c.status,
    cat.name AS category_name,
    cat.code AS category_code,
    u.abbreviation AS unit_abbreviation,
    inv.id AS inventory_item_id,
    inv.current_stock,
    inv.location_id AS inventory_location_id
  FROM public.warehouse_item_catalog c
  LEFT JOIN public.item_categories cat ON cat.id = c.category_id
  LEFT JOIN public.item_units      u   ON u.id   = c.unit_id
  LEFT JOIN LATERAL (
    SELECT i.id, i.current_stock, i.location_id
    FROM public.warehouse_items i
    WHERE i.catalog_item_id = c.id
      AND (p_target_company_id  IS NULL OR i.company_id  = p_target_company_id)
      AND (p_target_location_id IS NULL OR i.location_id = p_target_location_id)
    ORDER BY i.updated_at DESC NULLS LAST
    LIMIT 1
  ) inv ON true
  WHERE c.status = 'active'
    AND (
      p_include_all_categories
      OR p_category_ids IS NULL
      OR c.category_id = ANY(p_category_ids)
    )
    AND (
      p_search IS NULL
      OR p_search = ''
      OR c.name      ILIKE '%' || p_search || '%'
      OR c.item_code ILIKE '%' || p_search || '%'
      OR COALESCE(c.brand,'')   ILIKE '%' || p_search || '%'
      OR COALESCE(c.barcode,'') ILIKE '%' || p_search || '%'
      OR COALESCE(c.sku,'')     ILIKE '%' || p_search || '%'
    )
  ORDER BY c.name ASC, c.item_code ASC
  LIMIT COALESCE(p_limit, 20000);
$$;

GRANT EXECUTE ON FUNCTION public.get_tool_catalog_candidates(
  text, uuid[], boolean, uuid, uuid, int
) TO authenticated;