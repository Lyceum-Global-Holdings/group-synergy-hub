
-- ============================================================
-- PHASE 1: Unify tools into warehouse inventory
-- ============================================================

-- 1. Schema extensions ---------------------------------------------------
ALTER TABLE public.warehouse_item_catalog
  ADD COLUMN IF NOT EXISTS item_type text NOT NULL DEFAULT 'item'
    CHECK (item_type IN ('item','tool'));

CREATE INDEX IF NOT EXISTS warehouse_item_catalog_item_type_idx
  ON public.warehouse_item_catalog(item_type);

ALTER TABLE public.warehouse_items
  ADD COLUMN IF NOT EXISTS is_loanable boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS condition text;

CREATE INDEX IF NOT EXISTS warehouse_items_is_loanable_idx
  ON public.warehouse_items(is_loanable) WHERE is_loanable;

ALTER TABLE public.tool_issues
  ADD COLUMN IF NOT EXISTS warehouse_item_id uuid
    REFERENCES public.warehouse_items(id) ON DELETE SET NULL;

ALTER TABLE public.tool_returns
  ADD COLUMN IF NOT EXISTS warehouse_item_id uuid
    REFERENCES public.warehouse_items(id) ON DELETE SET NULL;

-- 2. One-time backfill: tools → catalog + items + allocations ----------
DO $mig$
DECLARE
  v_tool record;
  v_catalog_id uuid;
  v_item_id uuid;
  v_new_code text;
BEGIN
  FOR v_tool IN
    SELECT * FROM public.warehouse_tools
  LOOP
    -- 2a. Catalog row (prefix to avoid colliding with existing item codes)
    v_new_code := 'TOOL-' || v_tool.tool_code;

    INSERT INTO public.warehouse_item_catalog (
      item_code, name, description, category_id, unit_id,
      brand, image_url, unit_cost, status, item_type, created_by
    )
    VALUES (
      v_new_code, v_tool.name, v_tool.description, v_tool.category_id, v_tool.unit_id,
      NULL, v_tool.image_url, COALESCE(v_tool.unit_cost, 0), 'active', 'tool', v_tool.created_by
    )
    ON CONFLICT (item_code) DO UPDATE SET
      name = EXCLUDED.name,
      item_type = 'tool'
    RETURNING id INTO v_catalog_id;

    -- 2b. Per-company on-hand row
    INSERT INTO public.warehouse_items (
      catalog_item_id, company_id, location_id, current_stock,
      reserved_quantity, unit_cost, status, is_loanable, condition, created_by
    )
    VALUES (
      v_catalog_id, v_tool.company_id, v_tool.location_id,
      COALESCE(v_tool.total_quantity, 0), 0,
      v_tool.unit_cost, 'active', true, v_tool.condition, v_tool.created_by
    )
    ON CONFLICT (company_id, catalog_item_id) DO UPDATE SET
      is_loanable = true,
      condition = EXCLUDED.condition,
      current_stock = EXCLUDED.current_stock
    RETURNING id INTO v_item_id;

    -- 2c. Bin allocations
    INSERT INTO public.warehouse_bin_allocations (
      warehouse_item_id, bin_id, allocated_quantity, reserved_quantity,
      notes, company_id, created_by, location_id
    )
    SELECT
      v_item_id, a.bin_id, a.allocated_quantity, a.reserved_quantity,
      a.notes, a.company_id, a.created_by,
      (SELECT location_id FROM public.warehouse_bins WHERE id = a.bin_id)
    FROM public.tool_bin_allocations a
    WHERE a.tool_id = v_tool.id
    ON CONFLICT DO NOTHING;

    -- 2d. Link existing issues / returns to the new warehouse_item
    UPDATE public.tool_issues
      SET warehouse_item_id = v_item_id
      WHERE tool_id = v_tool.id AND warehouse_item_id IS NULL;

    UPDATE public.tool_returns r
      SET warehouse_item_id = v_item_id
      FROM public.tool_issues i
      WHERE r.issue_id = i.id
        AND i.tool_id = v_tool.id
        AND r.warehouse_item_id IS NULL;
  END LOOP;
END
$mig$;

-- 3. Forward sync: writes to warehouse_tools → warehouse_items ---------
CREATE OR REPLACE FUNCTION public.sync_tool_to_warehouse_item()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $fn$
DECLARE
  v_catalog_id uuid;
  v_item_id uuid;
  v_code text;
BEGIN
  IF pg_trigger_depth() > 1 THEN RETURN COALESCE(NEW, OLD); END IF;

  IF TG_OP = 'DELETE' THEN
    -- Cascade soft-delete: mark inventory inactive (do not hard-delete to
    -- preserve ledger history).
    UPDATE public.warehouse_items wi
      SET status = 'inactive', is_loanable = true
      FROM public.warehouse_item_catalog c
      WHERE wi.catalog_item_id = c.id
        AND c.item_code = 'TOOL-' || OLD.tool_code
        AND wi.company_id IS NOT DISTINCT FROM OLD.company_id;
    RETURN OLD;
  END IF;

  v_code := 'TOOL-' || NEW.tool_code;

  -- Upsert catalog
  INSERT INTO public.warehouse_item_catalog (
    item_code, name, description, category_id, unit_id,
    image_url, unit_cost, status, item_type, created_by
  )
  VALUES (
    v_code, NEW.name, NEW.description, NEW.category_id, NEW.unit_id,
    NEW.image_url, COALESCE(NEW.unit_cost, 0), 'active', 'tool', NEW.created_by
  )
  ON CONFLICT (item_code) DO UPDATE SET
    name = EXCLUDED.name,
    description = EXCLUDED.description,
    category_id = EXCLUDED.category_id,
    unit_id = EXCLUDED.unit_id,
    image_url = EXCLUDED.image_url,
    unit_cost = EXCLUDED.unit_cost,
    item_type = 'tool',
    updated_at = now()
  RETURNING id INTO v_catalog_id;

  -- Upsert per-company inventory row
  INSERT INTO public.warehouse_items (
    catalog_item_id, company_id, location_id, current_stock,
    reserved_quantity, unit_cost, status, is_loanable, condition, created_by
  )
  VALUES (
    v_catalog_id, NEW.company_id, NEW.location_id,
    COALESCE(NEW.total_quantity, 0), 0, NEW.unit_cost,
    'active', true, NEW.condition, NEW.created_by
  )
  ON CONFLICT (company_id, catalog_item_id) DO UPDATE SET
    location_id = EXCLUDED.location_id,
    current_stock = EXCLUDED.current_stock,
    unit_cost = EXCLUDED.unit_cost,
    is_loanable = true,
    condition = EXCLUDED.condition,
    status = 'active',
    updated_at = now()
  RETURNING id INTO v_item_id;

  RETURN NEW;
END
$fn$;

DROP TRIGGER IF EXISTS trg_sync_tool_to_warehouse_item ON public.warehouse_tools;
CREATE TRIGGER trg_sync_tool_to_warehouse_item
  AFTER INSERT OR UPDATE OR DELETE ON public.warehouse_tools
  FOR EACH ROW EXECUTE FUNCTION public.sync_tool_to_warehouse_item();

-- 4. Forward sync: tool_bin_allocations → warehouse_bin_allocations ----
CREATE OR REPLACE FUNCTION public.sync_tool_bin_alloc_to_warehouse()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $fn$
DECLARE
  v_item_id uuid;
  v_loc uuid;
BEGIN
  IF pg_trigger_depth() > 1 THEN RETURN COALESCE(NEW, OLD); END IF;

  IF TG_OP = 'DELETE' THEN
    -- Map old tool_id → warehouse_items.id and remove the matching allocation
    SELECT wi.id INTO v_item_id
      FROM public.warehouse_tools t
      JOIN public.warehouse_item_catalog c ON c.item_code = 'TOOL-' || t.tool_code
      JOIN public.warehouse_items wi ON wi.catalog_item_id = c.id
                                     AND wi.company_id IS NOT DISTINCT FROM t.company_id
      WHERE t.id = OLD.tool_id;
    IF v_item_id IS NOT NULL THEN
      DELETE FROM public.warehouse_bin_allocations
        WHERE warehouse_item_id = v_item_id AND bin_id = OLD.bin_id;
    END IF;
    RETURN OLD;
  END IF;

  SELECT wi.id INTO v_item_id
    FROM public.warehouse_tools t
    JOIN public.warehouse_item_catalog c ON c.item_code = 'TOOL-' || t.tool_code
    JOIN public.warehouse_items wi ON wi.catalog_item_id = c.id
                                   AND wi.company_id IS NOT DISTINCT FROM t.company_id
    WHERE t.id = NEW.tool_id;

  IF v_item_id IS NULL THEN
    RETURN NEW; -- tool not yet mirrored; skip silently
  END IF;

  SELECT location_id INTO v_loc FROM public.warehouse_bins WHERE id = NEW.bin_id;

  INSERT INTO public.warehouse_bin_allocations (
    warehouse_item_id, bin_id, allocated_quantity, reserved_quantity,
    notes, company_id, created_by, location_id
  )
  VALUES (
    v_item_id, NEW.bin_id, NEW.allocated_quantity, NEW.reserved_quantity,
    NEW.notes, NEW.company_id, NEW.created_by, v_loc
  )
  ON CONFLICT (warehouse_item_id, bin_id) DO UPDATE SET
    allocated_quantity = EXCLUDED.allocated_quantity,
    reserved_quantity  = EXCLUDED.reserved_quantity,
    notes              = EXCLUDED.notes,
    updated_at         = now();

  RETURN NEW;
END
$fn$;

-- Add (warehouse_item_id, bin_id) UNIQUE if missing (needed for ON CONFLICT)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'warehouse_bin_allocations_item_bin_unique'
  ) THEN
    BEGIN
      ALTER TABLE public.warehouse_bin_allocations
        ADD CONSTRAINT warehouse_bin_allocations_item_bin_unique UNIQUE (warehouse_item_id, bin_id);
    EXCEPTION WHEN unique_violation THEN
      -- Existing duplicates — skip; reconcile path already handles them.
      NULL;
    END;
  END IF;
END $$;

DROP TRIGGER IF EXISTS trg_sync_tool_bin_alloc_to_warehouse ON public.tool_bin_allocations;
CREATE TRIGGER trg_sync_tool_bin_alloc_to_warehouse
  AFTER INSERT OR UPDATE OR DELETE ON public.tool_bin_allocations
  FOR EACH ROW EXECUTE FUNCTION public.sync_tool_bin_alloc_to_warehouse();

-- 5. Reverse sync: warehouse_items → warehouse_tools (loanable only) ---
CREATE OR REPLACE FUNCTION public.sync_warehouse_item_to_tool()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $fn$
DECLARE
  v_code text;
  v_tool_id uuid;
BEGIN
  IF pg_trigger_depth() > 1 THEN RETURN NEW; END IF;
  IF NEW.is_loanable IS NOT TRUE THEN RETURN NEW; END IF;

  SELECT c.item_code INTO v_code
    FROM public.warehouse_item_catalog c WHERE c.id = NEW.catalog_item_id;
  IF v_code IS NULL OR v_code NOT LIKE 'TOOL-%' THEN RETURN NEW; END IF;

  SELECT id INTO v_tool_id FROM public.warehouse_tools
    WHERE tool_code = substring(v_code from 6)
      AND company_id IS NOT DISTINCT FROM NEW.company_id;

  IF v_tool_id IS NOT NULL THEN
    UPDATE public.warehouse_tools SET
      total_quantity      = COALESCE(NEW.current_stock, 0)::integer,
      available_quantity  = GREATEST(0, COALESCE(NEW.current_stock, 0)::integer - COALESCE(issued_quantity, 0)),
      condition           = COALESCE(NEW.condition, condition),
      location_id         = COALESCE(NEW.location_id, location_id),
      updated_at          = now()
    WHERE id = v_tool_id;
  END IF;

  RETURN NEW;
END
$fn$;

DROP TRIGGER IF EXISTS trg_sync_warehouse_item_to_tool ON public.warehouse_items;
CREATE TRIGGER trg_sync_warehouse_item_to_tool
  AFTER UPDATE OF current_stock, condition, location_id, status ON public.warehouse_items
  FOR EACH ROW EXECUTE FUNCTION public.sync_warehouse_item_to_tool();

-- 6. Reverse sync: warehouse_bin_allocations → tool_bin_allocations ----
CREATE OR REPLACE FUNCTION public.sync_warehouse_bin_alloc_to_tool()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $fn$
DECLARE
  v_is_loanable boolean;
  v_code text;
  v_tool_id uuid;
BEGIN
  IF pg_trigger_depth() > 1 THEN RETURN COALESCE(NEW, OLD); END IF;

  SELECT wi.is_loanable, c.item_code
    INTO v_is_loanable, v_code
    FROM public.warehouse_items wi
    JOIN public.warehouse_item_catalog c ON c.id = wi.catalog_item_id
    WHERE wi.id = COALESCE(NEW.warehouse_item_id, OLD.warehouse_item_id);

  IF NOT COALESCE(v_is_loanable, false) OR v_code IS NULL OR v_code NOT LIKE 'TOOL-%' THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  SELECT id INTO v_tool_id FROM public.warehouse_tools
    WHERE tool_code = substring(v_code from 6)
      AND company_id IS NOT DISTINCT FROM COALESCE(NEW.company_id, OLD.company_id);
  IF v_tool_id IS NULL THEN RETURN COALESCE(NEW, OLD); END IF;

  IF TG_OP = 'DELETE' THEN
    DELETE FROM public.tool_bin_allocations
      WHERE tool_id = v_tool_id AND bin_id = OLD.bin_id;
    RETURN OLD;
  END IF;

  INSERT INTO public.tool_bin_allocations (
    tool_id, bin_id, allocated_quantity, reserved_quantity, notes, company_id, created_by
  )
  VALUES (
    v_tool_id, NEW.bin_id, NEW.allocated_quantity, NEW.reserved_quantity,
    NEW.notes, NEW.company_id, NEW.created_by
  )
  ON CONFLICT (tool_id, bin_id) DO UPDATE SET
    allocated_quantity = EXCLUDED.allocated_quantity,
    reserved_quantity  = EXCLUDED.reserved_quantity,
    notes              = EXCLUDED.notes,
    updated_at         = now();

  RETURN NEW;
END
$fn$;

DROP TRIGGER IF EXISTS trg_sync_warehouse_bin_alloc_to_tool ON public.warehouse_bin_allocations;
CREATE TRIGGER trg_sync_warehouse_bin_alloc_to_tool
  AFTER INSERT OR UPDATE OR DELETE ON public.warehouse_bin_allocations
  FOR EACH ROW EXECUTE FUNCTION public.sync_warehouse_bin_alloc_to_tool();
