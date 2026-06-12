CREATE OR REPLACE FUNCTION public.grn_items_fill_item_snapshot()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_catalog_id uuid;
  v_code text;
  v_name text;
  v_uom text;
BEGIN
  -- Resolve catalog id
  v_catalog_id := NEW.catalog_item_id;
  IF v_catalog_id IS NULL AND NEW.warehouse_item_id IS NOT NULL THEN
    SELECT catalog_item_id INTO v_catalog_id
    FROM public.warehouse_items
    WHERE id = NEW.warehouse_item_id;
    IF v_catalog_id IS NOT NULL THEN
      NEW.catalog_item_id := v_catalog_id;
    END IF;
  END IF;

  IF v_catalog_id IS NOT NULL THEN
    SELECT c.item_code, c.name, u.name
      INTO v_code, v_name, v_uom
    FROM public.warehouse_item_catalog c
    LEFT JOIN public.item_units u ON u.id = c.unit_id
    WHERE c.id = v_catalog_id;

    IF NEW.item_code IS NULL OR btrim(NEW.item_code) = '' THEN
      NEW.item_code := v_code;
    END IF;
    IF NEW.item_name IS NULL OR btrim(NEW.item_name) = '' THEN
      NEW.item_name := v_name;
    END IF;
    IF NEW.unit_of_measure IS NULL OR btrim(NEW.unit_of_measure) = '' THEN
      NEW.unit_of_measure := v_uom;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_grn_items_fill_item_snapshot ON public.grn_items;
CREATE TRIGGER trg_grn_items_fill_item_snapshot
BEFORE INSERT OR UPDATE ON public.grn_items
FOR EACH ROW EXECUTE FUNCTION public.grn_items_fill_item_snapshot();

-- One-time backfill
UPDATE public.grn_items gi
SET item_code = COALESCE(NULLIF(btrim(gi.item_code), ''), c.item_code),
    item_name = COALESCE(NULLIF(btrim(gi.item_name), ''), c.name),
    unit_of_measure = COALESCE(NULLIF(btrim(gi.unit_of_measure), ''), u.name),
    catalog_item_id = COALESCE(gi.catalog_item_id, wi.catalog_item_id)
FROM public.warehouse_items wi
LEFT JOIN public.warehouse_item_catalog c ON c.id = wi.catalog_item_id
LEFT JOIN public.item_units u ON u.id = c.unit_id
WHERE wi.id = gi.warehouse_item_id
  AND (
    gi.item_code IS NULL OR btrim(gi.item_code) = ''
    OR gi.item_name IS NULL OR btrim(gi.item_name) = ''
    OR gi.unit_of_measure IS NULL OR btrim(gi.unit_of_measure) = ''
  );

UPDATE public.grn_items gi
SET item_code = COALESCE(NULLIF(btrim(gi.item_code), ''), c.item_code),
    item_name = COALESCE(NULLIF(btrim(gi.item_name), ''), c.name),
    unit_of_measure = COALESCE(NULLIF(btrim(gi.unit_of_measure), ''), u.name)
FROM public.warehouse_item_catalog c
LEFT JOIN public.item_units u ON u.id = c.unit_id
WHERE c.id = gi.catalog_item_id
  AND (
    gi.item_code IS NULL OR btrim(gi.item_code) = ''
    OR gi.item_name IS NULL OR btrim(gi.item_name) = ''
    OR gi.unit_of_measure IS NULL OR btrim(gi.unit_of_measure) = ''
  );