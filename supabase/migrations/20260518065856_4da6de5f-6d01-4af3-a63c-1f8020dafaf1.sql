-- 1. Cached forward pointer
ALTER TABLE public.warehouse_tools
  ADD COLUMN IF NOT EXISTS warehouse_item_id uuid
    REFERENCES public.warehouse_items(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS warehouse_tools_warehouse_item_id_idx
  ON public.warehouse_tools(warehouse_item_id);

-- 2. Backfill
UPDATE public.warehouse_tools
SET warehouse_item_id = sub.item_id
FROM (
  SELECT t.id AS tool_id, wi.id AS item_id
  FROM public.warehouse_tools t
  JOIN public.warehouse_item_catalog c
    ON c.item_code = 'TOOL-' || t.tool_code
  JOIN public.warehouse_items wi
    ON wi.catalog_item_id = c.id
   AND wi.company_id = t.company_id
) sub
WHERE warehouse_tools.id = sub.tool_id
  AND warehouse_tools.warehouse_item_id IS NULL;

-- 3. Forward sync trigger
CREATE OR REPLACE FUNCTION public.sync_tool_to_warehouse_item()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_catalog_id uuid;
  v_item_id    uuid;
  v_code       text;
BEGIN
  IF pg_trigger_depth() > 1 THEN
    IF TG_OP = 'DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
  END IF;

  IF TG_OP = 'DELETE' THEN
    UPDATE public.warehouse_items wi
       SET status = 'inactive'
      FROM public.warehouse_item_catalog c
     WHERE wi.catalog_item_id = c.id
       AND c.item_code = 'TOOL-' || OLD.tool_code
       AND wi.company_id = OLD.company_id;
    RETURN OLD;
  END IF;

  v_code := 'TOOL-' || NEW.tool_code;

  INSERT INTO public.warehouse_item_catalog (item_code, name, item_type, category_id, unit_id)
  VALUES (v_code, NEW.name, 'tool', NEW.category_id, NEW.unit_id)
  ON CONFLICT (item_code) DO UPDATE
    SET name = EXCLUDED.name,
        category_id = COALESCE(EXCLUDED.category_id, public.warehouse_item_catalog.category_id),
        unit_id     = COALESCE(EXCLUDED.unit_id,     public.warehouse_item_catalog.unit_id),
        item_type   = 'tool'
  RETURNING id INTO v_catalog_id;

  INSERT INTO public.warehouse_items (
    company_id, catalog_item_id, location_id,
    current_stock, is_loanable, condition, status, created_by
  ) VALUES (
    NEW.company_id, v_catalog_id, NEW.location_id,
    NEW.total_quantity, true, NEW.condition, 'active', NEW.created_by
  )
  ON CONFLICT (catalog_item_id, company_id) DO UPDATE
    SET location_id   = COALESCE(EXCLUDED.location_id, public.warehouse_items.location_id),
        current_stock = EXCLUDED.current_stock,
        is_loanable   = true,
        condition     = EXCLUDED.condition
  RETURNING id INTO v_item_id;

  IF NEW.warehouse_item_id IS DISTINCT FROM v_item_id THEN
    NEW.warehouse_item_id := v_item_id;
  END IF;

  RETURN NEW;
END;
$$;

-- 4. Reverse sync trigger
CREATE OR REPLACE FUNCTION public.sync_warehouse_item_to_tool()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_code      text;
  v_tool_code text;
BEGIN
  IF pg_trigger_depth() > 1 THEN
    IF TG_OP = 'DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
  END IF;

  IF TG_OP = 'DELETE' THEN
    DELETE FROM public.warehouse_tools
     WHERE warehouse_item_id = OLD.id;
    RETURN OLD;
  END IF;

  IF NOT COALESCE(NEW.is_loanable, false) THEN
    RETURN NEW;
  END IF;

  SELECT item_code INTO v_code
    FROM public.warehouse_item_catalog
   WHERE id = NEW.catalog_item_id;

  IF v_code IS NULL THEN RETURN NEW; END IF;

  v_tool_code := CASE
    WHEN v_code LIKE 'TOOL-%' THEN substring(v_code FROM 6)
    ELSE v_code
  END;

  INSERT INTO public.warehouse_tools (
    tool_code, name, company_id, location_id, category_id, unit_id,
    total_quantity, available_quantity, issued_quantity, condition,
    warehouse_item_id, created_by
  )
  SELECT v_tool_code,
         c.name,
         NEW.company_id,
         NEW.location_id,
         c.category_id,
         c.unit_id,
         COALESCE(NEW.current_stock, 0),
         COALESCE(NEW.current_stock, 0),
         0,
         NEW.condition,
         NEW.id,
         NEW.created_by
    FROM public.warehouse_item_catalog c
   WHERE c.id = NEW.catalog_item_id
  ON CONFLICT (tool_code, company_id) DO UPDATE
    SET name              = EXCLUDED.name,
        location_id       = COALESCE(EXCLUDED.location_id, public.warehouse_tools.location_id),
        category_id       = COALESCE(EXCLUDED.category_id, public.warehouse_tools.category_id),
        unit_id           = COALESCE(EXCLUDED.unit_id, public.warehouse_tools.unit_id),
        total_quantity    = EXCLUDED.total_quantity,
        condition         = EXCLUDED.condition,
        warehouse_item_id = EXCLUDED.warehouse_item_id;

  RETURN NEW;
END;
$$;

-- 5. get_warehouse_tools_list — expose warehouse_item_id (no brand/model/etc — those columns don't exist)
DROP FUNCTION IF EXISTS public.get_warehouse_tools_list(uuid, uuid, integer);
CREATE OR REPLACE FUNCTION public.get_warehouse_tools_list(
  p_company_id uuid DEFAULT NULL,
  p_location_id uuid DEFAULT NULL,
  p_limit integer DEFAULT 5000
)
RETURNS TABLE (
  id uuid,
  tool_code text,
  name text,
  description text,
  category_id uuid,
  unit_id uuid,
  location_id uuid,
  company_id uuid,
  total_quantity integer,
  available_quantity integer,
  issued_quantity integer,
  condition text,
  unit_cost numeric,
  image_url text,
  notes text,
  catalog_item_id uuid,
  warehouse_item_id uuid,
  created_at timestamptz,
  updated_at timestamptz,
  created_by uuid,
  category_name text,
  location_name text,
  unit_name text,
  unit_abbreviation text
)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT
    t.id, t.tool_code, t.name, t.description,
    t.category_id, t.unit_id, t.location_id, t.company_id,
    t.total_quantity, t.available_quantity, t.issued_quantity,
    t.condition, t.unit_cost, t.image_url, t.notes,
    t.catalog_item_id, t.warehouse_item_id,
    t.created_at, t.updated_at, t.created_by,
    cat.name AS category_name,
    loc.name AS location_name,
    u.name   AS unit_name,
    u.abbreviation AS unit_abbreviation
  FROM public.warehouse_tools t
  LEFT JOIN public.item_categories cat ON cat.id = t.category_id
  LEFT JOIN public.warehouse_locations loc ON loc.id = t.location_id
  LEFT JOIN public.item_units u ON u.id = t.unit_id
  WHERE (p_company_id IS NULL OR t.company_id = p_company_id)
    AND (p_location_id IS NULL OR t.location_id = p_location_id)
  ORDER BY t.created_at DESC
  LIMIT p_limit;
$$;