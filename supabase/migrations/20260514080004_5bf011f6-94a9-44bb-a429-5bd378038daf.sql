
ALTER TABLE public.warehouse_items
  ADD COLUMN IF NOT EXISTS base_uom text,
  ADD COLUMN IF NOT EXISTS secondary_uom text,
  ADD COLUMN IF NOT EXISTS track_secondary_quantity boolean NOT NULL DEFAULT false;

-- Best-effort backfill base_uom from warehouse_units if available
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='warehouse_units') THEN
    EXECUTE $sql$
      UPDATE public.warehouse_items wi
         SET base_uom = COALESCE(u.code, u.name)
        FROM public.warehouse_units u
       WHERE wi.unit_id = u.id
         AND wi.base_uom IS NULL
    $sql$;
  END IF;
END $$;

ALTER TABLE public.warehouse_bin_allocations
  ADD COLUMN IF NOT EXISTS secondary_quantity numeric;

ALTER TABLE public.stock_transactions
  ADD COLUMN IF NOT EXISTS secondary_quantity_change numeric,
  ADD COLUMN IF NOT EXISTS secondary_quantity_before numeric,
  ADD COLUMN IF NOT EXISTS secondary_quantity_after  numeric,
  ADD COLUMN IF NOT EXISTS secondary_uom text;

ALTER TABLE public.grn_items
  ADD COLUMN IF NOT EXISTS secondary_quantity_received numeric,
  ADD COLUMN IF NOT EXISTS secondary_uom text,
  ADD COLUMN IF NOT EXISTS conversion_note text;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='warehouse_batches') THEN
    EXECUTE 'ALTER TABLE public.warehouse_batches
      ADD COLUMN IF NOT EXISTS secondary_quantity_remaining numeric,
      ADD COLUMN IF NOT EXISTS secondary_uom text';
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.set_stock_transaction_balances()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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
    SELECT COALESCE(allocated_quantity,0), COALESCE(secondary_quantity,0)
      INTO v_base_before, v_sec_before
      FROM public.warehouse_bin_allocations
     WHERE warehouse_item_id = NEW.item_id
       AND bin_id = NEW.bin_id
     LIMIT 1;
  ELSIF NEW.location_id IS NOT NULL THEN
    SELECT COALESCE(SUM(ba.allocated_quantity),0),
           COALESCE(SUM(ba.secondary_quantity),0)
      INTO v_base_before, v_sec_before
      FROM public.warehouse_bin_allocations ba
      JOIN public.warehouse_bins b ON b.id = ba.bin_id
     WHERE ba.warehouse_item_id = NEW.item_id
       AND b.location_id = NEW.location_id;
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
