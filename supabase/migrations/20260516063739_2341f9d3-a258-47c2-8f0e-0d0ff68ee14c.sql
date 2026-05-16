CREATE OR REPLACE FUNCTION public.set_stock_transaction_balances()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_base_before numeric := 0;
  v_sec_before  numeric := 0;
  v_track_sec   boolean := false;
  v_sec_uom     text;
BEGIN
  SELECT COALESCE(track_secondary_quantity,false), secondary_uom
    INTO v_track_sec, v_sec_uom
    FROM public.warehouse_items
   WHERE id = NEW.item_id;

  IF NEW.bin_id IS NOT NULL THEN
    SELECT COALESCE(SUM(allocated_quantity),0), COALESCE(SUM(secondary_quantity),0)
      INTO v_base_before, v_sec_before
      FROM public.warehouse_bin_allocations
     WHERE warehouse_item_id = NEW.item_id
       AND bin_id = NEW.bin_id
       AND (NEW.location_id IS NULL OR location_id = NEW.location_id);
  ELSIF NEW.location_id IS NOT NULL THEN
    SELECT COALESCE(SUM(allocated_quantity),0), COALESCE(SUM(secondary_quantity),0)
      INTO v_base_before, v_sec_before
      FROM public.warehouse_bin_allocations
     WHERE warehouse_item_id = NEW.item_id
       AND location_id = NEW.location_id;
  ELSE
    SELECT COALESCE(current_stock,0)
      INTO v_base_before
      FROM public.warehouse_items
     WHERE id = NEW.item_id;
    v_sec_before := 0;
  END IF;

  NEW.quantity_before := v_base_before;
  NEW.quantity_after  := v_base_before + COALESCE(NEW.quantity_change,0);

  IF v_track_sec THEN
    NEW.secondary_uom := COALESCE(NEW.secondary_uom, v_sec_uom);
    NEW.secondary_quantity_before := v_sec_before;
    NEW.secondary_quantity_after  := v_sec_before + COALESCE(NEW.secondary_quantity_change,0);
  END IF;

  RETURN NEW;
END;
$$;