-- GRN lines must identify an item (ISO 9001 §7.5 documented information):
-- blank manual rows used to save with only a quantity, producing "-" lines on
-- the note that could never be approved and carried no traceable identity.
--
-- 1. Backfill: recover name/code for existing blank lines that ARE linked to
--    the item master (warehouse item or catalog).
-- 2. Guard: reject new/edited lines that carry no identity at all.

-- 1a. Blank lines linked via warehouse_item_id → take name/code from catalog.
UPDATE public.grn_items gi
   SET item_name = c.name,
       item_code = COALESCE(NULLIF(btrim(gi.item_code), ''), c.item_code),
       updated_at = now()
  FROM public.warehouse_items wi
  JOIN public.warehouse_item_catalog c ON c.id = wi.catalog_item_id
 WHERE wi.id = gi.warehouse_item_id
   AND COALESCE(btrim(gi.item_name), '') = '';

-- 1b. Blank lines linked via catalog_item_id only.
UPDATE public.grn_items gi
   SET item_name = c.name,
       item_code = COALESCE(NULLIF(btrim(gi.item_code), ''), c.item_code),
       updated_at = now()
  FROM public.warehouse_item_catalog c
 WHERE c.id = gi.catalog_item_id
   AND COALESCE(btrim(gi.item_name), '') = '';

-- 2. Guard trigger: a line must be linked to the item master OR carry a name
--    or code. (Trigger, not CHECK, so legacy unlinkable rows don't block the
--    migration — they only fail when someone tries to touch them again.)
CREATE OR REPLACE FUNCTION public.grn_items_require_identity()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.warehouse_item_id IS NULL
     AND NEW.catalog_item_id IS NULL
     AND COALESCE(btrim(NEW.item_name), '') = ''
     AND COALESCE(btrim(NEW.item_code), '') = '' THEN
    RAISE EXCEPTION 'GRN line must identify an item (link it to the item master or provide a name/code)'
      USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_grn_items_require_identity ON public.grn_items;
CREATE TRIGGER trg_grn_items_require_identity
  BEFORE INSERT OR UPDATE ON public.grn_items
  FOR EACH ROW EXECUTE FUNCTION public.grn_items_require_identity();
