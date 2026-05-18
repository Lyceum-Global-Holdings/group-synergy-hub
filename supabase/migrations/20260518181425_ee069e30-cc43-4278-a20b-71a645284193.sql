-- Extend get_warehouse_catalog_page with server-side sort + matching keyset cursor.
-- Backward compatible: defaults preserve previous behavior when older clients call.

-- Supporting indexes for new sort keys (id tiebreaker ensures strict monotonicity).
CREATE INDEX IF NOT EXISTS idx_warehouse_catalog_name_keyset
  ON public.warehouse_item_catalog (name ASC, id ASC);

CREATE INDEX IF NOT EXISTS idx_warehouse_catalog_code_keyset
  ON public.warehouse_item_catalog (item_code ASC, id ASC);

-- Drop the old signature so we can replace with one that has additional params.
DROP FUNCTION IF EXISTS public.get_warehouse_catalog_page(
  text, uuid, text, uuid, timestamptz, text, uuid, int
);

CREATE OR REPLACE FUNCTION public.get_warehouse_catalog_page(
  p_search          text        DEFAULT NULL,
  p_category_id     uuid        DEFAULT NULL,
  p_status          text        DEFAULT NULL,
  p_supplier_id     uuid        DEFAULT NULL,
  p_cursor_created  timestamptz DEFAULT NULL,
  p_cursor_code     text        DEFAULT NULL,
  p_cursor_id       uuid        DEFAULT NULL,
  p_limit           int         DEFAULT 50,
  p_sort_by         text        DEFAULT 'name',
  p_sort_dir        text        DEFAULT 'asc',
  p_cursor_name     text        DEFAULT NULL
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
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_sort_by  text := lower(coalesce(p_sort_by, 'name'));
  v_sort_dir text := lower(coalesce(p_sort_dir, 'asc'));
  v_search   text := CASE WHEN p_search IS NULL OR btrim(p_search) = '' THEN NULL
                          ELSE '%' || lower(btrim(p_search)) || '%' END;
  v_sql      text;
  v_order    text;
  v_keyset   text := '';
  v_cmp_lt   text;  -- 'ASC' uses >, 'DESC' uses <
BEGIN
  IF v_sort_by NOT IN ('name', 'item_code', 'created_at') THEN
    v_sort_by := 'name';
  END IF;
  IF v_sort_dir NOT IN ('asc', 'desc') THEN
    v_sort_dir := 'asc';
  END IF;

  v_cmp_lt := CASE WHEN v_sort_dir = 'asc' THEN '>' ELSE '<' END;

  -- ORDER BY uses sort key + id tiebreaker in the same direction (strictly monotonic).
  v_order := format(' ORDER BY c.%I %s, c.id %s ', v_sort_by, upper(v_sort_dir), upper(v_sort_dir));

  -- Keyset window — composite comparison on (sort_key, id) using the right operator.
  IF v_sort_by = 'name' AND p_cursor_name IS NOT NULL THEN
    v_keyset := format(
      ' AND (c.name %1$s $5 OR (c.name = $5 AND c.id %1$s $7)) ',
      v_cmp_lt
    );
  ELSIF v_sort_by = 'item_code' AND p_cursor_code IS NOT NULL THEN
    v_keyset := format(
      ' AND (c.item_code %1$s $6 OR (c.item_code = $6 AND c.id %1$s $7)) ',
      v_cmp_lt
    );
  ELSIF v_sort_by = 'created_at' AND p_cursor_created IS NOT NULL THEN
    v_keyset := format(
      ' AND (c.created_at %1$s $4 OR (c.created_at = $4 AND c.id %1$s $7)) ',
      v_cmp_lt
    );
  END IF;

  v_sql :=
    'SELECT c.id, c.item_code, c.name, c.description, c.category_id, c.unit_id,
            c.brand, c.barcode, c.sku, c.unit_cost, c.selling_price, c.reorder_level,
            c.status, c.image_url, c.supplier_id, s.name AS supplier_name, c.created_at
     FROM public.warehouse_item_catalog c
     LEFT JOIN public.suppliers s ON s.id = c.supplier_id
     WHERE ($1 IS NULL OR c.category_id = $1)
       AND ($2 IS NULL OR c.status = $2)
       AND ($3 IS NULL OR c.supplier_id = $3)
       AND ($8::text IS NULL
            OR lower(c.name)      LIKE $8
            OR lower(c.item_code) LIKE $8
            OR lower(c.brand)     LIKE $8
            OR lower(c.barcode)   LIKE $8
            OR lower(c.sku)       LIKE $8) '
    || v_keyset
    || v_order
    || ' LIMIT $9';

  RETURN QUERY EXECUTE v_sql
    USING
      p_category_id,        -- $1
      p_status,             -- $2
      p_supplier_id,        -- $3
      p_cursor_created,     -- $4
      p_cursor_name,        -- $5
      p_cursor_code,        -- $6
      p_cursor_id,          -- $7
      v_search,             -- $8
      COALESCE(p_limit, 50);-- $9
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_warehouse_catalog_page(
  text, uuid, text, uuid, timestamptz, text, uuid, int, text, text, text
) TO authenticated;