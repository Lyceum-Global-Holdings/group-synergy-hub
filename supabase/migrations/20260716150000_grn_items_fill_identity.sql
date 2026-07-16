-- Self-healing item identity on GRN lines.
--
-- Blank-named lines kept appearing: rows written by pre-fix frontend bundles
-- (open tabs keep running old code until reloaded) and rows created before the
-- identity guard was applied. Instead of chasing every writer, resolve identity
-- at the data layer:
--   • derive catalog_item_id from warehouse_item_id when missing,
--   • fill item_name / item_code from the catalog whenever they arrive blank
--     on a linked row (BEFORE trigger, alphabetically ahead of the require-
--     identity guard so healed rows pass it),
--   • backfill all existing rows the same way.

-- 1. Write-time healing.
CREATE OR REPLACE FUNCTION public.grn_items_fill_identity()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_cat record;
BEGIN
  -- Derive the catalog link from the warehouse link when absent.
  IF NEW.catalog_item_id IS NULL AND NEW.warehouse_item_id IS NOT NULL THEN
    SELECT wi.catalog_item_id INTO NEW.catalog_item_id
    FROM public.warehouse_items wi
    WHERE wi.id = NEW.warehouse_item_id;
  END IF;

  -- Fill blank name/code from the catalog.
  IF NEW.catalog_item_id IS NOT NULL
     AND (COALESCE(btrim(NEW.item_name), '') = '' OR COALESCE(btrim(NEW.item_code), '') = '') THEN
    SELECT c.name, c.item_code INTO v_cat
    FROM public.warehouse_item_catalog c
    WHERE c.id = NEW.catalog_item_id;
    IF FOUND THEN
      IF COALESCE(btrim(NEW.item_name), '') = '' THEN
        NEW.item_name := v_cat.name;
      END IF;
      IF COALESCE(btrim(NEW.item_code), '') = '' THEN
        NEW.item_code := v_cat.item_code;
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

-- "fill" sorts before "require": BEFORE triggers fire alphabetically, so rows
-- are healed before the identity guard evaluates them.
DROP TRIGGER IF EXISTS trg_grn_items_fill_identity ON public.grn_items;
CREATE TRIGGER trg_grn_items_fill_identity
  BEFORE INSERT OR UPDATE ON public.grn_items
  FOR EACH ROW EXECUTE FUNCTION public.grn_items_fill_identity();

-- 2. Backfill existing rows.
-- 2a. Derive missing catalog links from warehouse links.
UPDATE public.grn_items gi
   SET catalog_item_id = wi.catalog_item_id
  FROM public.warehouse_items wi
 WHERE wi.id = gi.warehouse_item_id
   AND gi.catalog_item_id IS NULL
   AND wi.catalog_item_id IS NOT NULL;

-- 2b. Fill blank name/code from the catalog.
UPDATE public.grn_items gi
   SET item_name = CASE WHEN COALESCE(btrim(gi.item_name), '') = '' THEN c.name ELSE gi.item_name END,
       item_code = CASE WHEN COALESCE(btrim(gi.item_code), '') = '' THEN c.item_code ELSE gi.item_code END,
       updated_at = now()
  FROM public.warehouse_item_catalog c
 WHERE c.id = gi.catalog_item_id
   AND (COALESCE(btrim(gi.item_name), '') = '' OR COALESCE(btrim(gi.item_code), '') = '');
