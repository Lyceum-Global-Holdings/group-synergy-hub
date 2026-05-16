-- ============================================================================
-- Stage 6b: Drop mirrored columns, retire sync triggers & nightly reconcile
-- ============================================================================

-- 0. Pre-flight: every inventory row must already link to catalog
DO $$
DECLARE n bigint;
BEGIN
  SELECT count(*) INTO n FROM public.warehouse_items WHERE catalog_item_id IS NULL;
  IF n > 0 THEN
    RAISE EXCEPTION 'Stage 6b aborted: % warehouse_items rows have NULL catalog_item_id', n;
  END IF;
END $$;

-- 1. Drop the BEFORE/AFTER sync triggers and their functions
DROP TRIGGER IF EXISTS wh_items_sync_from_catalog ON public.warehouse_items;
DROP FUNCTION IF EXISTS public.wh_items_sync_from_catalog() CASCADE;
DROP TRIGGER IF EXISTS wh_catalog_propagate ON public.warehouse_item_catalog;
DROP FUNCTION IF EXISTS public.wh_catalog_propagate() CASCADE;

-- 2. Retire the nightly reconcile cron + helper functions
DO $$
BEGIN
  PERFORM cron.unschedule('catalog-mirror-nightly-reconcile');
EXCEPTION WHEN OTHERS THEN
  NULL;
END $$;
DROP FUNCTION IF EXISTS public.reconcile_catalog_mirror() CASCADE;
DROP FUNCTION IF EXISTS public.check_catalog_mirror_parity() CASCADE;

-- 3. Drop the legacy view so column drop doesn't fight dependencies
DROP VIEW IF EXISTS public.warehouse_items_full CASCADE;

-- 4. Drop mirrored columns (CASCADE clears any leftover indexes that referenced them)
ALTER TABLE public.warehouse_items
  DROP COLUMN IF EXISTS item_code CASCADE,
  DROP COLUMN IF EXISTS name CASCADE,
  DROP COLUMN IF EXISTS description CASCADE,
  DROP COLUMN IF EXISTS category_id CASCADE,
  DROP COLUMN IF EXISTS unit_id CASCADE,
  DROP COLUMN IF EXISTS brand CASCADE,
  DROP COLUMN IF EXISTS manufacturer CASCADE,
  DROP COLUMN IF EXISTS supplier_id CASCADE,
  DROP COLUMN IF EXISTS barcode CASCADE,
  DROP COLUMN IF EXISTS sku CASCADE,
  DROP COLUMN IF EXISTS image_url CASCADE,
  DROP COLUMN IF EXISTS is_serialized CASCADE,
  DROP COLUMN IF EXISTS is_batch_tracked CASCADE;

-- 5. Recreate the warehouse_items_full view sourcing master fields from catalog
CREATE VIEW public.warehouse_items_full
WITH (security_invoker = true)
AS
SELECT
  wi.*,
  c.item_code,
  c.name,
  c.description,
  c.category_id,
  c.unit_id,
  c.brand,
  c.manufacturer,
  c.supplier_id,
  c.barcode,
  c.sku,
  c.image_url,
  c.is_serialized,
  c.is_batch_tracked
FROM public.warehouse_items wi
LEFT JOIN public.warehouse_item_catalog c ON c.id = wi.catalog_item_id;

REVOKE ALL ON public.warehouse_items_full FROM PUBLIC, anon;
GRANT SELECT ON public.warehouse_items_full TO authenticated;

-- 6. Enforce catalog_item_id NOT NULL on the per-company table
ALTER TABLE public.warehouse_items
  ALTER COLUMN catalog_item_id SET NOT NULL;

-- 7. Rewrite list_warehouse_inventory to source master fields from catalog
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
  ), scoped_alloc_full AS (
    SELECT
      a.warehouse_item_id,
      a.bin_id,
      wb.location_id AS stock_location_id,
      SUM(a.available_quantity) AS available_qty,
      SUM(a.reserved_quantity) AS reserved_qty,
      SUM(a.allocated_quantity) AS allocated_qty
    FROM public.warehouse_bin_allocations a
    JOIN public.warehouse_bins wb ON wb.id = a.bin_id
    CROSS JOIN has_scope hs
    WHERE (_company_id IS NULL OR a.company_id = _company_id)
      AND (
        hs.value = false
        OR wb.location_id IN (SELECT location_id FROM distinct_scope)
      )
    GROUP BY a.warehouse_item_id, a.bin_id, wb.location_id
  ), scoped_alloc AS (
    SELECT * FROM scoped_alloc_full WHERE allocated_qty > 0
  ), item_stock AS (
    SELECT
      warehouse_item_id,
      SUM(available_qty) AS available_qty,
      SUM(reserved_qty) AS reserved_qty,
      SUM(allocated_qty) AS allocated_qty
    FROM scoped_alloc
    GROUP BY warehouse_item_id
  ), base AS (
    SELECT
      wi.*,
      cat.item_code   AS m_item_code,
      cat.name        AS m_name,
      cat.description AS m_description,
      cat.category_id AS m_category_id,
      cat.unit_id     AS m_unit_id,
      cat.brand       AS m_brand,
      cat.manufacturer AS m_manufacturer,
      cat.supplier_id AS m_supplier_id,
      cat.barcode     AS m_barcode,
      cat.sku         AS m_sku,
      cat.image_url   AS m_image_url,
      ist.available_qty,
      ist.reserved_qty,
      ist.allocated_qty
    FROM public.warehouse_items wi
    JOIN public.warehouse_item_catalog cat ON cat.id = wi.catalog_item_id
    LEFT JOIN item_stock ist ON ist.warehouse_item_id = wi.id
    CROSS JOIN has_scope hs
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
        hs.value = false
        OR COALESCE(ist.allocated_qty, 0) > 0
        OR (
          _stock_mode = 'zero'
          AND wi.location_id IN (SELECT location_id FROM distinct_scope)
          AND COALESCE(ist.allocated_qty, 0) = 0
        )
      )
      AND (
        _stock_mode IS NULL OR _stock_mode = 'all'
        OR (_stock_mode = 'in_stock' AND COALESCE(CASE WHEN hs.value THEN ist.allocated_qty ELSE wi.current_stock END, 0) > 0)
        OR (_stock_mode = 'zero' AND COALESCE(CASE WHEN hs.value THEN ist.allocated_qty ELSE wi.current_stock END, 0) = 0)
        OR (_stock_mode = 'low' AND COALESCE(CASE WHEN hs.value THEN ist.allocated_qty ELSE wi.current_stock END, 0) > 0 AND COALESCE(CASE WHEN hs.value THEN ist.allocated_qty ELSE wi.current_stock END, 0) <= COALESCE(wi.reorder_level, 0))
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
    b.m_item_code,
    b.m_name,
    b.m_description,
    b.m_category_id,
    c.name AS category_name,
    b.m_unit_id,
    u.name AS unit_name,
    u.abbreviation AS unit_abbreviation,
    b.m_brand,
    b.m_manufacturer,
    b.m_supplier_id,
    s.name AS supplier_name,
    b.status,
    COALESCE(CASE WHEN hs.value THEN b.allocated_qty ELSE b.current_stock END, 0) AS current_stock,
    COALESCE(CASE WHEN hs.value THEN b.available_qty ELSE b.available_quantity END, 0) AS available_quantity,
    COALESCE(CASE WHEN hs.value THEN b.reserved_qty ELSE b.reserved_quantity END, 0) AS reserved_quantity,
    b.unit_cost,
    b.selling_price,
    b.reorder_level,
    b.min_stock_level,
    b.max_stock_level,
    b.m_image_url,
    b.company_id,
    b.created_at,
    b.updated_at,
    COALESCE((
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
      ) ORDER BY wl.name NULLS LAST, wb.bin_code)
      FROM scoped_alloc_full sa
      JOIN public.warehouse_bins wb ON wb.id = sa.bin_id
      LEFT JOIN public.warehouse_locations wl ON wl.id = sa.stock_location_id
      WHERE sa.warehouse_item_id = b.id
    ), '[]'::jsonb) AS bins
  FROM base b
  CROSS JOIN has_scope hs
  LEFT JOIN public.item_categories c ON c.id = b.m_category_id
  LEFT JOIN public.item_units u ON u.id = b.m_unit_id
  LEFT JOIN public.suppliers s ON s.id = b.m_supplier_id
  ORDER BY b.created_at DESC, b.id DESC;
$function$;