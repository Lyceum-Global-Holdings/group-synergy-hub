-- Add server-side sorting to list_warehouse_inventory.
-- Adds _sort_by (allowlist), _sort_dir (asc/desc) and sort-aware keyset cursors
-- for name, item_code, current_stock. Default sort becomes (name ASC, id ASC).
-- Filter-before-paginate is preserved by moving keyset cursor + LIMIT to after
-- the fully-filtered CTE.

DROP FUNCTION IF EXISTS public.list_warehouse_inventory(uuid, text, uuid, text, uuid[], timestamptz, uuid, int, text, uuid, text);

CREATE OR REPLACE FUNCTION public.list_warehouse_inventory(
  _company_id uuid DEFAULT NULL,
  _search text DEFAULT NULL,
  _category_id uuid DEFAULT NULL,
  _status text DEFAULT NULL,
  _location_ids uuid[] DEFAULT NULL,
  _cursor_created_at timestamp with time zone DEFAULT NULL,
  _cursor_id uuid DEFAULT NULL,
  _limit integer DEFAULT 50,
  _stock_mode text DEFAULT NULL,
  _supplier_id uuid DEFAULT NULL,
  _owner_label text DEFAULT NULL,
  _sort_by text DEFAULT 'name',
  _sort_dir text DEFAULT 'asc',
  _cursor_name text DEFAULT NULL,
  _cursor_item_code text DEFAULT NULL,
  _cursor_stock numeric DEFAULT NULL
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
  image_url text, company_id uuid,
  created_at timestamp with time zone, updated_at timestamp with time zone,
  bins jsonb, stock_owners text[]
)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_lbl text := NULLIF(btrim(_owner_label), '');
  v_q   text := NULLIF(btrim(_search), '');
  v_lim int  := COALESCE(GREATEST(_limit, 1), 50);
  v_super boolean := public.is_super_admin(auth.uid());
  v_scope_ids uuid[];
  v_has_scope boolean;
  v_accessible uuid[];
  v_sort text := lower(COALESCE(NULLIF(btrim(_sort_by), ''), 'name'));
  v_dir  text := lower(COALESCE(NULLIF(btrim(_sort_dir), ''), 'asc'));
BEGIN
  -- Allowlist sort key & direction
  IF v_sort NOT IN ('name','item_code','created_at','current_stock') THEN
    v_sort := 'name';
  END IF;
  IF v_dir NOT IN ('asc','desc') THEN
    v_dir := 'asc';
  END IF;

  -- Resolve location scope (subtree of requested locations)
  WITH RECURSIVE requested AS (
    SELECT DISTINCT x.location_id
    FROM unnest(COALESCE(_location_ids, ARRAY[]::uuid[])) AS x(location_id)
    WHERE x.location_id IS NOT NULL
  ), scope(location_id) AS (
    SELECT r.location_id FROM requested r
    UNION
    SELECT child.id
    FROM public.warehouse_locations child
    JOIN scope s ON child.parent_id = s.location_id
    WHERE child.status IS DISTINCT FROM 'inactive'
  )
  SELECT COALESCE(array_agg(location_id), ARRAY[]::uuid[])
    INTO v_scope_ids FROM scope;
  v_has_scope := array_length(v_scope_ids, 1) IS NOT NULL;

  -- Resolve accessible companies once
  IF v_super THEN
    v_accessible := NULL;
  ELSE
    SELECT COALESCE(array_agg(DISTINCT cid), ARRAY[]::uuid[]) INTO v_accessible
    FROM (
      SELECT p.company_id AS cid FROM public.profiles p
        WHERE p.user_id = auth.uid() AND p.company_id IS NOT NULL
      UNION
      SELECT uca.company_id FROM public.user_company_access uca
        WHERE uca.user_id = auth.uid() AND uca.company_id IS NOT NULL
    ) c;
  END IF;

  RETURN QUERY
  WITH base AS (
    SELECT wi.id,
           wi.company_id,
           wi.status,
           wi.unit_cost,
           wi.selling_price,
           wi.reorder_level,
           wi.min_stock_level,
           wi.max_stock_level,
           wi.created_at,
           wi.updated_at,
           wi.location_id AS wi_location_id,
           wi.current_stock AS wi_current_stock,
           wi.available_quantity AS wi_available_quantity,
           wi.reserved_quantity AS wi_reserved_quantity,
           wi.catalog_item_id,
           cat.item_code AS m_item_code,
           cat.name AS m_name,
           cat.description AS m_description,
           cat.category_id AS m_category_id,
           cat.unit_id AS m_unit_id,
           cat.brand AS m_brand,
           cat.manufacturer AS m_manufacturer,
           cat.supplier_id AS m_supplier_id,
           cat.image_url AS m_image_url
    FROM public.warehouse_items wi
    LEFT JOIN public.warehouse_item_catalog cat ON cat.id = wi.catalog_item_id
    WHERE (_company_id IS NULL OR wi.company_id = _company_id)
      AND (_status IS NULL OR wi.status = _status)
      AND (v_accessible IS NULL OR wi.company_id = ANY (v_accessible))
      AND (
        NOT v_has_scope
        OR EXISTS (
          SELECT 1 FROM public.warehouse_bin_allocations a
          WHERE a.warehouse_item_id = wi.id
            AND a.allocated_quantity > 0
            AND a.location_id = ANY (v_scope_ids)
            AND (_company_id IS NULL OR a.company_id = _company_id)
        )
        OR (_stock_mode = 'zero' AND wi.location_id = ANY (v_scope_ids))
      )
      AND (
        v_lbl IS NULL
        OR EXISTS (
          SELECT 1 FROM public.warehouse_bin_allocations a2
          WHERE a2.warehouse_item_id = wi.id
            AND a2.allocated_quantity > 0
            AND (_company_id IS NULL OR a2.company_id = _company_id)
            AND (
              (v_lbl = 'Unassigned' AND a2.stock_owner IS NULL)
              OR a2.stock_owner ILIKE v_lbl
            )
        )
      )
      AND (_category_id IS NULL OR cat.category_id = _category_id)
      AND (_supplier_id IS NULL OR cat.supplier_id = _supplier_id)
      AND (
        v_q IS NULL
        OR cat.name      ILIKE '%' || v_q || '%'
        OR cat.item_code ILIKE '%' || v_q || '%'
        OR COALESCE(cat.brand,'')   ILIKE '%' || v_q || '%'
        OR COALESCE(cat.barcode,'') ILIKE '%' || v_q || '%'
        OR COALESCE(cat.sku,'')     ILIKE '%' || v_q || '%'
      )
  ),
  with_stock AS (
    SELECT b.*, st.allocated_qty, st.available_qty, st.reserved_qty
    FROM base b
    LEFT JOIN LATERAL (
      SELECT SUM(a.allocated_quantity) AS allocated_qty,
             SUM(a.available_quantity) AS available_qty,
             SUM(a.reserved_quantity)  AS reserved_qty
      FROM public.warehouse_bin_allocations a
      WHERE a.warehouse_item_id = b.id
        AND (_company_id IS NULL OR a.company_id = _company_id)
        AND (
          v_lbl IS NULL
          OR (v_lbl = 'Unassigned' AND a.stock_owner IS NULL)
          OR a.stock_owner ILIKE v_lbl
        )
        AND (NOT v_has_scope OR a.location_id = ANY (v_scope_ids))
    ) st ON TRUE
  ),
  filtered AS (
    SELECT s.*,
           COALESCE(CASE WHEN v_has_scope THEN s.allocated_qty ELSE s.wi_current_stock END, 0) AS effective_stock
    FROM with_stock s
    WHERE (
      _stock_mode IS NULL OR _stock_mode = 'all'
      OR (_stock_mode = 'in_stock'
          AND COALESCE(CASE WHEN v_has_scope THEN s.allocated_qty ELSE s.wi_current_stock END, 0) > 0)
      OR (_stock_mode = 'zero'
          AND COALESCE(CASE WHEN v_has_scope THEN s.allocated_qty ELSE s.wi_current_stock END, 0) = 0)
      OR (_stock_mode = 'low'
          AND COALESCE(CASE WHEN v_has_scope THEN s.allocated_qty ELSE s.wi_current_stock END, 0) > 0
          AND COALESCE(CASE WHEN v_has_scope THEN s.allocated_qty ELSE s.wi_current_stock END, 0)
              <= COALESCE(s.reorder_level, 0))
    )
  ),
  paged AS (
    SELECT *
    FROM filtered f
    WHERE
      -- Keyset cursor: filter-before-paginate; tuple is strictly monotonic via id.
      CASE
        WHEN v_sort = 'name' AND v_dir = 'asc' THEN
          _cursor_name IS NULL
          OR (COALESCE(f.m_name,'') > _cursor_name)
          OR (COALESCE(f.m_name,'') = _cursor_name AND f.id > _cursor_id)
        WHEN v_sort = 'name' AND v_dir = 'desc' THEN
          _cursor_name IS NULL
          OR (COALESCE(f.m_name,'') < _cursor_name)
          OR (COALESCE(f.m_name,'') = _cursor_name AND f.id < _cursor_id)
        WHEN v_sort = 'item_code' AND v_dir = 'asc' THEN
          _cursor_item_code IS NULL
          OR (COALESCE(f.m_item_code,'') > _cursor_item_code)
          OR (COALESCE(f.m_item_code,'') = _cursor_item_code AND f.id > _cursor_id)
        WHEN v_sort = 'item_code' AND v_dir = 'desc' THEN
          _cursor_item_code IS NULL
          OR (COALESCE(f.m_item_code,'') < _cursor_item_code)
          OR (COALESCE(f.m_item_code,'') = _cursor_item_code AND f.id < _cursor_id)
        WHEN v_sort = 'current_stock' AND v_dir = 'asc' THEN
          _cursor_stock IS NULL
          OR (f.effective_stock > _cursor_stock)
          OR (f.effective_stock = _cursor_stock AND f.id > _cursor_id)
        WHEN v_sort = 'current_stock' AND v_dir = 'desc' THEN
          _cursor_stock IS NULL
          OR (f.effective_stock < _cursor_stock)
          OR (f.effective_stock = _cursor_stock AND f.id < _cursor_id)
        WHEN v_sort = 'created_at' AND v_dir = 'asc' THEN
          _cursor_created_at IS NULL
          OR (f.created_at > _cursor_created_at)
          OR (f.created_at = _cursor_created_at AND f.id > _cursor_id)
        ELSE -- created_at desc (legacy default)
          _cursor_created_at IS NULL
          OR (f.created_at < _cursor_created_at)
          OR (f.created_at = _cursor_created_at AND f.id < _cursor_id)
      END
    ORDER BY
      CASE WHEN v_sort = 'name'          AND v_dir = 'asc'  THEN COALESCE(f.m_name,'')      END ASC  NULLS LAST,
      CASE WHEN v_sort = 'name'          AND v_dir = 'desc' THEN COALESCE(f.m_name,'')      END DESC NULLS LAST,
      CASE WHEN v_sort = 'item_code'     AND v_dir = 'asc'  THEN COALESCE(f.m_item_code,'') END ASC  NULLS LAST,
      CASE WHEN v_sort = 'item_code'     AND v_dir = 'desc' THEN COALESCE(f.m_item_code,'') END DESC NULLS LAST,
      CASE WHEN v_sort = 'current_stock' AND v_dir = 'asc'  THEN f.effective_stock          END ASC  NULLS LAST,
      CASE WHEN v_sort = 'current_stock' AND v_dir = 'desc' THEN f.effective_stock          END DESC NULLS LAST,
      CASE WHEN v_sort = 'created_at'    AND v_dir = 'asc'  THEN f.created_at               END ASC  NULLS LAST,
      CASE WHEN v_sort = 'created_at'    AND v_dir = 'desc' THEN f.created_at               END DESC NULLS LAST,
      CASE WHEN v_dir = 'asc'  THEN f.id END ASC,
      CASE WHEN v_dir = 'desc' THEN f.id END DESC
    LIMIT v_lim
  ),
  page_bins AS (
    SELECT f.id AS item_id,
           jsonb_agg(jsonb_build_object(
             'id', wb.id, 'bin_code', wb.bin_code, 'name', wb.name,
             'quantity', sa.available_qty, 'allocated_quantity', sa.allocated_qty,
             'reserved_quantity', sa.reserved_qty,
             'location_id', sa.stock_location_id, 'location_name', wl.name,
             'root_location_id', COALESCE(wb.root_location_id, wb.location_id)
           ) ORDER BY wl.name NULLS LAST, wb.bin_code) AS bins
    FROM paged f
    JOIN LATERAL (
      SELECT a.bin_id, a.location_id AS stock_location_id,
             SUM(a.available_quantity) AS available_qty,
             SUM(a.allocated_quantity) AS allocated_qty,
             SUM(a.reserved_quantity)  AS reserved_qty
      FROM public.warehouse_bin_allocations a
      WHERE a.warehouse_item_id = f.id
        AND a.allocated_quantity > 0
        AND (_company_id IS NULL OR a.company_id = _company_id)
        AND (
          v_lbl IS NULL
          OR (v_lbl = 'Unassigned' AND a.stock_owner IS NULL)
          OR a.stock_owner ILIKE v_lbl
        )
        AND (NOT v_has_scope OR a.location_id = ANY (v_scope_ids))
      GROUP BY a.bin_id, a.location_id
    ) sa ON TRUE
    JOIN public.warehouse_bins wb ON wb.id = sa.bin_id
    LEFT JOIN public.warehouse_locations wl ON wl.id = sa.stock_location_id
    GROUP BY f.id
  ),
  page_owners AS (
    SELECT f.id AS item_id,
           array_agg(DISTINCT COALESCE(a.stock_owner, 'Unassigned')) AS owners
    FROM paged f
    LEFT JOIN public.warehouse_bin_allocations a
      ON a.warehouse_item_id = f.id
     AND a.allocated_quantity > 0
     AND (_company_id IS NULL OR a.company_id = _company_id)
     AND (
       v_lbl IS NULL
       OR (v_lbl = 'Unassigned' AND a.stock_owner IS NULL)
       OR a.stock_owner ILIKE v_lbl
     )
     AND (NOT v_has_scope OR a.location_id = ANY (v_scope_ids))
    GROUP BY f.id
  )
  SELECT
    f.id, f.m_item_code, f.m_name, f.m_description,
    f.m_category_id, cc.name,
    f.m_unit_id, u.name, u.abbreviation,
    f.m_brand, f.m_manufacturer,
    f.m_supplier_id, sup.name,
    f.status,
    COALESCE(CASE WHEN v_has_scope THEN f.allocated_qty ELSE f.wi_current_stock END, 0),
    COALESCE(CASE WHEN v_has_scope THEN f.available_qty ELSE f.wi_available_quantity END, 0),
    COALESCE(CASE WHEN v_has_scope THEN f.reserved_qty  ELSE f.wi_reserved_quantity  END, 0),
    f.unit_cost, f.selling_price, f.reorder_level, f.min_stock_level, f.max_stock_level,
    f.m_image_url, f.company_id, f.created_at, f.updated_at,
    COALESCE(pb.bins, '[]'::jsonb),
    COALESCE(po.owners, ARRAY[]::text[])
  FROM paged f
  LEFT JOIN public.item_categories cc ON cc.id = f.m_category_id
  LEFT JOIN public.item_units u       ON u.id = f.m_unit_id
  LEFT JOIN public.suppliers sup      ON sup.id = f.m_supplier_id
  LEFT JOIN page_bins   pb ON pb.item_id = f.id
  LEFT JOIN page_owners po ON po.item_id = f.id
  ORDER BY
    CASE WHEN v_sort = 'name'          AND v_dir = 'asc'  THEN COALESCE(f.m_name,'')      END ASC  NULLS LAST,
    CASE WHEN v_sort = 'name'          AND v_dir = 'desc' THEN COALESCE(f.m_name,'')      END DESC NULLS LAST,
    CASE WHEN v_sort = 'item_code'     AND v_dir = 'asc'  THEN COALESCE(f.m_item_code,'') END ASC  NULLS LAST,
    CASE WHEN v_sort = 'item_code'     AND v_dir = 'desc' THEN COALESCE(f.m_item_code,'') END DESC NULLS LAST,
    CASE WHEN v_sort = 'current_stock' AND v_dir = 'asc'  THEN f.effective_stock          END ASC  NULLS LAST,
    CASE WHEN v_sort = 'current_stock' AND v_dir = 'desc' THEN f.effective_stock          END DESC NULLS LAST,
    CASE WHEN v_sort = 'created_at'    AND v_dir = 'asc'  THEN f.created_at               END ASC  NULLS LAST,
    CASE WHEN v_sort = 'created_at'    AND v_dir = 'desc' THEN f.created_at               END DESC NULLS LAST,
    CASE WHEN v_dir = 'asc'  THEN f.id END ASC,
    CASE WHEN v_dir = 'desc' THEN f.id END DESC;
END;
$function$;

REVOKE ALL ON FUNCTION public.list_warehouse_inventory(uuid, text, uuid, text, uuid[], timestamptz, uuid, int, text, uuid, text, text, text, text, text, numeric) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.list_warehouse_inventory(uuid, text, uuid, text, uuid[], timestamptz, uuid, int, text, uuid, text, text, text, text, text, numeric) TO authenticated;