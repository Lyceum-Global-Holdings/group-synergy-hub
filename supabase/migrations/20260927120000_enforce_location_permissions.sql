-- Enforce location permissions in the database, not only on screens.
--
-- Until now user_location_permissions (edited in Users & Roles) was applied only
-- by the screens: the location picker and a few list hooks. Anyone could read or
-- write other locations' rows through the API. The June 2026 attempt to scope
-- material returns used a different, unmaintained table
-- (user_location_assignments) and hid returns from everyone without a row there,
-- so it was reverted in 20260704170000.
--
-- This migration applies the SAME rules the screens use, from the SAME table:
--   • admins and super admins                    → every location
--   • profiles.view_all_locations = true         → every location
--   • users with NO rows in user_location_permissions → every location
--     (the screens are fail-open for unconfigured users; so is this)
--   • everyone else → the granted locations (view or edit) and all their
--     sub-locations
-- Rows with no location stay visible (company rules still apply).
-- For unrestricted users every new check short-circuits to true, so nothing
-- changes for them. Only users with explicit grants are narrowed — exactly the
-- users the screens already narrow.
--
-- Safety valve: security_settings.enforce_location_access (Security settings →
-- Location access) switches every check below off at once.
--
-- View vs edit: the database enforces access to a location (view or edit). The
-- finer "edit" rule stays in the screens that use it (stock-transfer source bins,
-- bin moves, construction inventory), because many view-only users create
-- documents at their location today.

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. Safety valve
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.security_settings
  ADD COLUMN IF NOT EXISTS enforce_location_access boolean NOT NULL DEFAULT true;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. Scope functions
-- ─────────────────────────────────────────────────────────────────────────────

-- Locations a user may access. NULL = unrestricted.
CREATE OR REPLACE FUNCTION public.location_scope_ids(_user_id uuid)
RETURNS uuid[]
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ids uuid[];
BEGIN
  IF _user_id IS NULL THEN
    RETURN ARRAY[]::uuid[];
  END IF;

  IF NOT COALESCE(
       (SELECT s.enforce_location_access FROM public.security_settings s WHERE s.id = 'global'),
       true) THEN
    RETURN NULL;
  END IF;

  IF public.is_admin(_user_id) THEN
    RETURN NULL;
  END IF;

  IF COALESCE(
       (SELECT p.view_all_locations FROM public.profiles p WHERE p.user_id = _user_id LIMIT 1),
       false) THEN
    RETURN NULL;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.user_location_permissions u WHERE u.user_id = _user_id) THEN
    RETURN NULL;
  END IF;

  WITH RECURSIVE granted(id) AS (
    SELECT u.location_id
    FROM public.user_location_permissions u
    WHERE u.user_id = _user_id
    UNION
    SELECT l.id
    FROM public.warehouse_locations l
    JOIN granted g ON l.parent_id = g.id
  )
  SELECT array_agg(id) INTO v_ids FROM granted;

  RETURN COALESCE(v_ids, ARRAY[]::uuid[]);
END;
$$;

-- Current user's scope. Policies call it as (SELECT public.my_location_scope())
-- so it is evaluated once per statement, not once per row.
CREATE OR REPLACE FUNCTION public.my_location_scope()
RETURNS uuid[]
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.location_scope_ids(auth.uid())
$$;

-- Single-location check for a given user (used by functions and older policies).
CREATE OR REPLACE FUNCTION public.user_location_allowed(_user_id uuid, _location_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT _location_id IS NULL
      OR s.ids IS NULL
      OR _location_id = ANY (s.ids)
  FROM (SELECT public.location_scope_ids(_user_id) AS ids) s
$$;

-- The June 2026 material-return policies call user_has_location_access, which
-- read the unmaintained user_location_assignments table. Point it at the real
-- permissions so those policies follow the same rules as everything else.
CREATE OR REPLACE FUNCTION public.user_has_location_access(_user_id uuid, _location_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.user_location_allowed(_user_id, _location_id)
$$;

REVOKE ALL ON FUNCTION public.location_scope_ids(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.user_location_allowed(uuid, uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.my_location_scope() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.my_location_scope() TO authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. Restrictive "Location scope" policies. RESTRICTIVE policies are ANDed with
--    the existing ones, so they can only narrow access, never widen it. Tables
--    or columns that do not exist in this database are skipped with a notice.
-- ─────────────────────────────────────────────────────────────────────────────
DO $$
DECLARE
  t record;
  v_pred text;
  v_scope constant text := '(SELECT public.my_location_scope())';
  -- The cast makes ANY(...) take the array itself. Without it, Postgres reads
  -- ANY ((SELECT ...)) as "each row of a subquery" and compares uuid = uuid[].
  v_ids constant text := '(SELECT public.my_location_scope())::uuid[]';
BEGIN
  FOR t IN
    SELECT * FROM (VALUES
      -- table,                               column 1,              column 2,         parent table,              parent key
      ('warehouse_bins',                      'location_id',         NULL,             NULL,                      NULL),
      ('warehouse_bin_allocations',           'location_id',         NULL,             NULL,                      NULL),
      ('stock_transactions',                  'location_id',         NULL,             NULL,                      NULL),
      ('goods_receipt_notes',                 'location_id',         NULL,             NULL,                      NULL),
      ('material_issue_notes',                'location_id',         NULL,             NULL,                      NULL),
      ('material_return_notes',               'location_id',         NULL,             NULL,                      NULL),
      ('material_requests',                   'location_id',         NULL,             NULL,                      NULL),
      ('cycle_counts',                        'location_id',         NULL,             NULL,                      NULL),
      ('stock_adjustment_batches',            'location_id',         NULL,             NULL,                      NULL),
      ('warehouse_partial_pieces',            'location_id',         NULL,             NULL,                      NULL),
      ('warehouse_assets',                    'location_id',         NULL,             NULL,                      NULL),
      ('warehouse_tools',                     'location_id',         NULL,             NULL,                      NULL),
      ('tool_units',                          'location_id',         NULL,             NULL,                      NULL),
      ('construction_inventory_stock',        'location_id',         NULL,             NULL,                      NULL),
      ('construction_inventory_transactions', 'location_id',         NULL,             NULL,                      NULL),
      ('construction_serial_numbers',         'current_location_id', NULL,             NULL,                      NULL),
      ('construction_labour_master',          'location_id',         NULL,             NULL,                      NULL),
      ('daily_site_reports',                  'location_id',         NULL,             NULL,                      NULL),
      -- movements between two locations: visible if either end is permitted
      ('stock_transfer_requests',             'from_location_id',    'to_location_id', NULL,                      NULL),
      ('asset_transfers',                     'from_location_id',    'to_location_id', NULL,                      NULL),
      ('construction_inventory_transfers',    'from_location_id',    'to_location_id', NULL,                      NULL),
      -- document lines: follow their header
      ('grn_items',                           NULL,                  NULL,             'goods_receipt_notes',     'grn_id'),
      ('material_issue_items',                NULL,                  NULL,             'material_issue_notes',    'min_id'),
      ('material_request_items',              NULL,                  NULL,             'material_requests',       'request_id'),
      ('stock_transfer_items',                NULL,                  NULL,             'stock_transfer_requests', 'transfer_id'),
      ('material_return_items',               NULL,                  NULL,             'material_return_notes',   'mrn_id'),
      ('cycle_count_items',                   NULL,                  NULL,             'cycle_counts',            'cycle_count_id')
    ) AS v(tbl, col1, col2, parent_tbl, parent_key)
  LOOP
    IF to_regclass('public.' || t.tbl) IS NULL
       OR (t.parent_tbl IS NOT NULL AND to_regclass('public.' || t.parent_tbl) IS NULL) THEN
      RAISE NOTICE 'enforce_location_permissions: skipped % (table missing)', t.tbl;
      CONTINUE;
    END IF;

    IF EXISTS (
      SELECT 1
      FROM unnest(ARRAY[t.col1, t.col2, t.parent_key]) AS c(name)
      WHERE c.name IS NOT NULL
        AND NOT EXISTS (
          SELECT 1 FROM information_schema.columns ic
          WHERE ic.table_schema = 'public' AND ic.table_name = t.tbl AND ic.column_name = c.name
        )
    ) THEN
      RAISE NOTICE 'enforce_location_permissions: skipped % (column missing)', t.tbl;
      CONTINUE;
    END IF;

    IF t.parent_tbl IS NOT NULL THEN
      -- Unrestricted users short-circuit before the header lookup.
      v_pred := format(
        '(%1$s IS NULL OR EXISTS (SELECT 1 FROM public.%2$I p WHERE p.id = %3$I.%4$I))',
        v_scope, t.parent_tbl, t.tbl, t.parent_key);
    ELSIF t.col2 IS NOT NULL THEN
      v_pred := format(
        '((%1$I IS NULL AND %2$I IS NULL) OR %3$s IS NULL OR %1$I = ANY (%4$s) OR %2$I = ANY (%4$s))',
        t.col1, t.col2, v_scope, v_ids);
    ELSE
      v_pred := format(
        '(%1$I IS NULL OR %2$s IS NULL OR %1$I = ANY (%3$s))',
        t.col1, v_scope, v_ids);
    END IF;

    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', 'Location scope', t.tbl);
    EXECUTE format(
      'CREATE POLICY %I ON public.%I AS RESTRICTIVE FOR ALL TO authenticated USING %s WITH CHECK %s',
      'Location scope', t.tbl, v_pred, v_pred);
    RAISE NOTICE 'enforce_location_permissions: % scoped', t.tbl;
  END LOOP;
END $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. list_warehouse_inventory (the Inventory page) runs as SECURITY DEFINER, so
--    table policies do not reach it. Clamp its location filter to the caller's
--    scope. Body otherwise unchanged from 20260623170938.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.list_warehouse_inventory(
  _company_id uuid DEFAULT NULL,
  _search text DEFAULT NULL,
  _category_id uuid DEFAULT NULL,
  _status text DEFAULT NULL,
  _location_ids uuid[] DEFAULT NULL,
  _cursor_created_at timestamptz DEFAULT NULL,
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
  created_at timestamptz, updated_at timestamptz,
  bins jsonb, stock_owners text[],
  last_purchase_price numeric, last_purchase_date timestamptz,
  last_purchase_supplier_name text, last_purchase_grn_number text
)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
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
  v_loc_allowed uuid[] := public.my_location_scope();
BEGIN
  -- Location permissions (20260927120000): a restricted user only ever sees
  -- stock at permitted locations, whatever _location_ids the caller sends.
  IF v_loc_allowed IS NOT NULL THEN
    IF _location_ids IS NULL OR array_length(_location_ids, 1) IS NULL THEN
      _location_ids := v_loc_allowed;
    ELSE
      _location_ids := ARRAY(SELECT x FROM unnest(_location_ids) AS x WHERE x = ANY (v_loc_allowed));
    END IF;
    IF array_length(_location_ids, 1) IS NULL THEN
      -- Nothing permitted: an id that matches no location, never "all".
      _location_ids := ARRAY['00000000-0000-0000-0000-000000000000'::uuid];
    END IF;
  END IF;

  IF v_sort NOT IN ('name','item_code','created_at','current_stock') THEN
    v_sort := 'name';
  END IF;
  IF v_dir NOT IN ('asc','desc') THEN
    v_dir := 'asc';
  END IF;

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
           -- Master catalog is source of truth; fall back to per-company cache.
           COALESCE(NULLIF(cat.unit_cost, 0), NULLIF(wi.unit_cost, 0), 0)::numeric AS unit_cost,
           COALESCE(NULLIF(cat.selling_price, 0), NULLIF(wi.selling_price, 0), 0)::numeric AS selling_price,
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
           cat.image_url AS m_image_url,
           cat.last_purchase_price AS m_last_purchase_price,
           cat.last_purchase_date  AS m_last_purchase_date,
           cat.last_purchase_supplier_id AS m_last_purchase_supplier_id,
           cat.last_purchase_grn_id AS m_last_purchase_grn_id
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
        ELSE
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
    COALESCE(po.owners, ARRAY[]::text[]),
    f.m_last_purchase_price,
    f.m_last_purchase_date,
    lps.name,
    lpg.grn_number
  FROM paged f
  LEFT JOIN public.item_categories cc ON cc.id = f.m_category_id
  LEFT JOIN public.item_units u       ON u.id = f.m_unit_id
  LEFT JOIN public.suppliers sup      ON sup.id = f.m_supplier_id
  LEFT JOIN public.suppliers lps      ON lps.id = f.m_last_purchase_supplier_id
  LEFT JOIN public.goods_receipt_notes lpg ON lpg.id = f.m_last_purchase_grn_id
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
