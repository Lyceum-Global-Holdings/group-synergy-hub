
-- 1. New audit columns on master catalog
ALTER TABLE public.warehouse_item_catalog
  ADD COLUMN IF NOT EXISTS last_purchase_price numeric,
  ADD COLUMN IF NOT EXISTS last_purchase_date  timestamptz,
  ADD COLUMN IF NOT EXISTS last_purchase_supplier_id uuid,
  ADD COLUMN IF NOT EXISTS last_purchase_grn_id uuid;

-- 2. Strengthened GRN -> master sync trigger
CREATE OR REPLACE FUNCTION public.sync_item_price_on_grn_approval()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_item RECORD;
  v_received_at timestamptz := COALESCE(NEW.approved_date, now());
BEGIN
  IF NEW.status NOT IN ('approved','completed') THEN
    RETURN NEW;
  END IF;
  IF OLD.status = NEW.status THEN
    RETURN NEW;
  END IF;

  -- Order so the latest line per item wins deterministically when looped.
  FOR v_item IN
    SELECT gi.*
    FROM public.grn_items gi
    WHERE gi.grn_id = NEW.id
      AND COALESCE(gi.quality_status, 'good') <> 'rejected'
      AND COALESCE(gi.quantity_received, 0) > 0
    ORDER BY gi.created_at ASC, gi.id ASC
  LOOP
    INSERT INTO public.warehouse_item_price_history (
      catalog_item_id, warehouse_item_id, company_id,
      grn_id, grn_item_id, grn_number, grn_date,
      po_id, po_number,
      supplier_id, supplier_name,
      unit_price, quantity_received, total_cost,
      received_at, created_by
    ) VALUES (
      v_item.catalog_item_id, v_item.warehouse_item_id, NEW.company_id,
      NEW.id, v_item.id, NEW.grn_number, NEW.grn_date,
      NEW.po_id, NEW.po_number,
      NEW.supplier_id, NEW.supplier_name,
      COALESCE(v_item.unit_price, 0),
      COALESCE(v_item.quantity_received, 0),
      COALESCE(v_item.total_cost, COALESCE(v_item.unit_price,0) * COALESCE(v_item.quantity_received,0)),
      v_received_at,
      NEW.approved_by
    )
    ON CONFLICT (grn_item_id) DO NOTHING;

    IF v_item.catalog_item_id IS NOT NULL AND COALESCE(v_item.unit_price,0) > 0 THEN
      UPDATE public.warehouse_item_catalog
        SET unit_cost                 = v_item.unit_price,
            last_purchase_price       = v_item.unit_price,
            last_purchase_date        = v_received_at,
            last_purchase_supplier_id = NEW.supplier_id,
            last_purchase_grn_id      = NEW.id,
            updated_at                = now()
        WHERE id = v_item.catalog_item_id;
    END IF;

    IF v_item.catalog_item_id IS NOT NULL AND NEW.company_id IS NOT NULL AND COALESCE(v_item.unit_price,0) > 0 THEN
      UPDATE public.warehouse_items
        SET unit_cost = v_item.unit_price, updated_at = now()
        WHERE catalog_item_id = v_item.catalog_item_id
          AND company_id = NEW.company_id;
    END IF;
  END LOOP;

  RETURN NEW;
END;
$$;

-- 3. Backfill master last_purchase_* from existing price history
WITH latest AS (
  SELECT DISTINCT ON (catalog_item_id)
    catalog_item_id, unit_price, received_at, supplier_id, grn_id
  FROM public.warehouse_item_price_history
  WHERE catalog_item_id IS NOT NULL AND unit_price > 0
  ORDER BY catalog_item_id, received_at DESC
)
UPDATE public.warehouse_item_catalog c
  SET unit_cost                 = COALESCE(c.unit_cost, l.unit_price),
      last_purchase_price       = l.unit_price,
      last_purchase_date        = l.received_at,
      last_purchase_supplier_id = l.supplier_id,
      last_purchase_grn_id      = l.grn_id,
      updated_at                = now()
FROM latest l
WHERE c.id = l.catalog_item_id;

-- 4. Item Master list RPC: master price is source of truth (fallback to per-company cache)
DROP FUNCTION IF EXISTS public.list_warehouse_inventory(
  uuid, text, uuid, text, uuid[], timestamptz, uuid, integer, text, uuid, text, text, text, text, text, numeric
);

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
BEGIN
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

GRANT EXECUTE ON FUNCTION public.list_warehouse_inventory(
  uuid, text, uuid, text, uuid[], timestamptz, uuid, integer, text, uuid, text, text, text, text, text, numeric
) TO authenticated;
