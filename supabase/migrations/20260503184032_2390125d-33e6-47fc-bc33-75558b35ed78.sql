-- Sync warehouse_items.location_id from bin allocations (WMS standard: bin owns location)

CREATE OR REPLACE FUNCTION public.recompute_item_primary_location(p_item_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_loc uuid;
BEGIN
  SELECT b.location_id
    INTO v_loc
  FROM warehouse_bin_allocations a
  JOIN warehouse_bins b ON b.id = a.bin_id
  WHERE a.warehouse_item_id = p_item_id
    AND a.available_quantity > 0
    AND b.location_id IS NOT NULL
  GROUP BY b.location_id
  ORDER BY SUM(a.available_quantity) DESC
  LIMIT 1;

  IF v_loc IS NOT NULL THEN
    UPDATE warehouse_items
       SET location_id = v_loc,
           updated_at = now()
     WHERE id = p_item_id
       AND (location_id IS DISTINCT FROM v_loc);
  END IF;
END;
$$;

-- Trigger: when allocations change, resync the item's primary location
CREATE OR REPLACE FUNCTION public.tg_sync_item_location_from_allocation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    PERFORM public.recompute_item_primary_location(OLD.warehouse_item_id);
    RETURN OLD;
  END IF;

  PERFORM public.recompute_item_primary_location(NEW.warehouse_item_id);

  -- If item moved to a different bin, also re-evaluate the old item linkage
  IF TG_OP = 'UPDATE' AND OLD.warehouse_item_id IS DISTINCT FROM NEW.warehouse_item_id THEN
    PERFORM public.recompute_item_primary_location(OLD.warehouse_item_id);
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_item_location_from_allocation ON public.warehouse_bin_allocations;
CREATE TRIGGER trg_sync_item_location_from_allocation
AFTER INSERT OR UPDATE OR DELETE ON public.warehouse_bin_allocations
FOR EACH ROW
EXECUTE FUNCTION public.tg_sync_item_location_from_allocation();

-- Trigger: when a bin's location changes, resync every item allocated to it
CREATE OR REPLACE FUNCTION public.tg_sync_items_when_bin_relocated()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r record;
BEGIN
  IF NEW.location_id IS DISTINCT FROM OLD.location_id THEN
    FOR r IN
      SELECT DISTINCT warehouse_item_id
      FROM warehouse_bin_allocations
      WHERE bin_id = NEW.id
    LOOP
      PERFORM public.recompute_item_primary_location(r.warehouse_item_id);
    END LOOP;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_items_when_bin_relocated ON public.warehouse_bins;
CREATE TRIGGER trg_sync_items_when_bin_relocated
AFTER UPDATE OF location_id ON public.warehouse_bins
FOR EACH ROW
EXECUTE FUNCTION public.tg_sync_items_when_bin_relocated();

-- One-time backfill: set every item's location to its dominant bin's location
WITH dominant AS (
  SELECT DISTINCT ON (a.warehouse_item_id)
         a.warehouse_item_id,
         b.location_id
  FROM warehouse_bin_allocations a
  JOIN warehouse_bins b ON b.id = a.bin_id
  WHERE a.available_quantity > 0
    AND b.location_id IS NOT NULL
  ORDER BY a.warehouse_item_id, a.available_quantity DESC
)
UPDATE warehouse_items wi
   SET location_id = d.location_id,
       updated_at  = now()
  FROM dominant d
 WHERE wi.id = d.warehouse_item_id
   AND wi.location_id IS DISTINCT FROM d.location_id;