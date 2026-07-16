-- Fix: GRN approval failed with "column wi.is_batch_tracked does not exist".
--
-- create_batches_on_grn_approval filtered batch-tracked lines via
-- warehouse_items.is_batch_tracked, but that flag lives on
-- warehouse_item_catalog (warehouse_items only carries catalog_item_id).
-- The reference was carried forward from the original 2026-01 trigger, which
-- had the same latent defect. Resolve through the catalog join.

CREATE OR REPLACE FUNCTION public.create_batches_on_grn_approval()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF (NEW.status IN ('approved', 'completed') AND OLD.status NOT IN ('approved', 'completed')) THEN
    -- Accepted → active stock.
    INSERT INTO public.item_batches (
      warehouse_item_id, batch_number, manufacturing_date, expiry_date,
      quantity_received, quantity_remaining, unit_cost, grn_item_id, company_id, status
    )
    SELECT
      gi.warehouse_item_id,
      COALESCE(gi.batch_number, 'BATCH-' || to_char(NOW(), 'YYYYMMDD-HH24MISS') || '-' || SUBSTRING(gi.id::text, 1, 8)),
      gi.manufacturing_date, gi.expiry_date,
      gi.quantity_accepted, gi.quantity_accepted,
      COALESCE(gi.net_unit_price, gi.unit_price),
      gi.id, NEW.company_id, 'active'
    FROM public.grn_items gi
    JOIN public.warehouse_items wi ON wi.id = gi.warehouse_item_id
    JOIN public.warehouse_item_catalog c ON c.id = wi.catalog_item_id
    WHERE gi.grn_id = NEW.id
      AND COALESCE(gi.quantity_accepted, 0) > 0
      AND c.is_batch_tracked = true
    ON CONFLICT (warehouse_item_id, batch_number, company_id)
    DO UPDATE SET
      quantity_received = item_batches.quantity_received + EXCLUDED.quantity_received,
      quantity_remaining = item_batches.quantity_remaining + EXCLUDED.quantity_received,
      updated_at = NOW();

    -- Rejected → quarantine (segregated, not issuable).
    INSERT INTO public.item_batches (
      warehouse_item_id, batch_number, manufacturing_date, expiry_date,
      quantity_received, quantity_remaining, unit_cost, grn_item_id, company_id,
      status, notes
    )
    SELECT
      gi.warehouse_item_id,
      COALESCE(gi.batch_number, 'BATCH-' || to_char(NOW(), 'YYYYMMDD-HH24MISS') || '-' || SUBSTRING(gi.id::text, 1, 8)) || '-QTN',
      gi.manufacturing_date, gi.expiry_date,
      gi.quantity_rejected, gi.quantity_rejected,
      COALESCE(gi.net_unit_price, gi.unit_price),
      gi.id, NEW.company_id, 'quarantine',
      'Rejected on GRN ' || COALESCE(NEW.grn_number, '') ||
        ' — ' || COALESCE(gi.rejection_reason::text, 'unspecified') ||
        COALESCE(': ' || gi.rejection_notes, '')
    FROM public.grn_items gi
    JOIN public.warehouse_items wi ON wi.id = gi.warehouse_item_id
    JOIN public.warehouse_item_catalog c ON c.id = wi.catalog_item_id
    WHERE gi.grn_id = NEW.id
      AND COALESCE(gi.quantity_rejected, 0) > 0
      AND c.is_batch_tracked = true
    ON CONFLICT (warehouse_item_id, batch_number, company_id)
    DO UPDATE SET
      quantity_received = item_batches.quantity_received + EXCLUDED.quantity_received,
      quantity_remaining = item_batches.quantity_remaining + EXCLUDED.quantity_received,
      updated_at = NOW();
  END IF;

  RETURN NEW;
END;
$$;
