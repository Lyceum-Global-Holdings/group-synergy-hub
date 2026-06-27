-- Stock transfers are bin-to-bin: the items carry from_bin_id/to_bin_id, but the
-- request header's from_location_id/to_location_id (shown in the FROM/TO columns)
-- were often left NULL because several creation paths don't set them. Derive the
-- header locations from the items' bins server-side so they're always populated,
-- regardless of which UI created the transfer.

CREATE OR REPLACE FUNCTION public.sync_stock_transfer_locations()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_from uuid;
  v_to   uuid;
BEGIN
  SELECT location_id INTO v_from FROM public.warehouse_bins WHERE id = NEW.from_bin_id;
  SELECT location_id INTO v_to   FROM public.warehouse_bins WHERE id = NEW.to_bin_id;

  UPDATE public.stock_transfer_requests r
     SET from_location_id = COALESCE(r.from_location_id, v_from),
         to_location_id   = COALESCE(r.to_location_id, v_to)
   WHERE r.id = NEW.transfer_id
     AND (r.from_location_id IS NULL OR r.to_location_id IS NULL);

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_stock_transfer_locations ON public.stock_transfer_items;
CREATE TRIGGER trg_sync_stock_transfer_locations
  AFTER INSERT OR UPDATE OF from_bin_id, to_bin_id ON public.stock_transfer_items
  FOR EACH ROW EXECUTE FUNCTION public.sync_stock_transfer_locations();

-- Backfill existing transfers from their items' bins (first item wins).
UPDATE public.stock_transfer_requests r
   SET from_location_id = COALESCE(r.from_location_id, sub.floc),
       to_location_id   = COALESCE(r.to_location_id, sub.tloc)
  FROM (
    SELECT DISTINCT ON (i.transfer_id) i.transfer_id,
           fb.location_id AS floc, tb.location_id AS tloc
      FROM public.stock_transfer_items i
      LEFT JOIN public.warehouse_bins fb ON fb.id = i.from_bin_id
      LEFT JOIN public.warehouse_bins tb ON tb.id = i.to_bin_id
     ORDER BY i.transfer_id, i.created_at
  ) sub
 WHERE sub.transfer_id = r.id
   AND (r.from_location_id IS NULL OR r.to_location_id IS NULL);
