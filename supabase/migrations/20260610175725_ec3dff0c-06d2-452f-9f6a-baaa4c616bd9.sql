CREATE OR REPLACE FUNCTION public.create_batches_on_grn_approval()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF (NEW.status IN ('approved', 'completed') AND OLD.status NOT IN ('approved', 'completed')) THEN
    INSERT INTO public.item_batches (
      warehouse_item_id, batch_number, manufacturing_date, expiry_date,
      quantity_received, quantity_remaining, unit_cost, grn_item_id, company_id
    )
    SELECT
      gi.warehouse_item_id,
      COALESCE(gi.batch_number, 'BATCH-' || to_char(NOW(), 'YYYYMMDD-HH24MISS') || '-' || SUBSTRING(gi.id::text, 1, 8)),
      gi.manufacturing_date, gi.expiry_date,
      gi.quantity_received, gi.quantity_received, gi.unit_price,
      gi.id, NEW.company_id
    FROM public.grn_items gi
    JOIN public.warehouse_items_full wi ON wi.id = gi.warehouse_item_id
    WHERE gi.grn_id = NEW.id
      AND gi.quality_status = 'good'
      AND gi.quantity_received > 0
      AND wi.is_batch_tracked = true
    ON CONFLICT (warehouse_item_id, batch_number, company_id)
    DO UPDATE SET
      quantity_received = item_batches.quantity_received + EXCLUDED.quantity_received,
      quantity_remaining = item_batches.quantity_remaining + EXCLUDED.quantity_received,
      updated_at = NOW();
  END IF;
  RETURN NEW;
END;
$function$;