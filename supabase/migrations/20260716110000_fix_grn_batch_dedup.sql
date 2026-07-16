-- Fix: GRN approval failed with "ON CONFLICT DO UPDATE command cannot affect
-- row a second time".
--
-- A GRN can carry the same item on multiple lines sharing one batch number
-- (e.g. two lines of the same item, both labelled LOT-...-0001). The set-based
-- INSERT ... ON CONFLICT in create_batches_on_grn_approval then maps two source
-- rows onto one conflict target (warehouse_item_id, batch_number, company_id)
-- within a single statement, which Postgres forbids. Process lines one at a
-- time instead: each subsequent line legally tops up the batch row the previous
-- line created. grn_item_id keeps the first contributing line for traceability.

CREATE OR REPLACE FUNCTION public.create_batches_on_grn_approval()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  gi record;
BEGIN
  IF (NEW.status IN ('approved', 'completed') AND OLD.status NOT IN ('approved', 'completed')) THEN
    FOR gi IN
      SELECT g.*
      FROM public.grn_items g
      JOIN public.warehouse_items wi ON wi.id = g.warehouse_item_id
      JOIN public.warehouse_item_catalog c ON c.id = wi.catalog_item_id
      WHERE g.grn_id = NEW.id
        AND c.is_batch_tracked = true
        AND (COALESCE(g.quantity_accepted, 0) > 0 OR COALESCE(g.quantity_rejected, 0) > 0)
      ORDER BY g.created_at, g.id
    LOOP
      -- Accepted → active stock.
      IF COALESCE(gi.quantity_accepted, 0) > 0 THEN
        INSERT INTO public.item_batches (
          warehouse_item_id, batch_number, manufacturing_date, expiry_date,
          quantity_received, quantity_remaining, unit_cost, grn_item_id, company_id, status
        ) VALUES (
          gi.warehouse_item_id,
          COALESCE(gi.batch_number, 'BATCH-' || to_char(NOW(), 'YYYYMMDD-HH24MISS') || '-' || SUBSTRING(gi.id::text, 1, 8)),
          gi.manufacturing_date, gi.expiry_date,
          gi.quantity_accepted, gi.quantity_accepted,
          COALESCE(gi.net_unit_price, gi.unit_price),
          gi.id, NEW.company_id, 'active'
        )
        ON CONFLICT (warehouse_item_id, batch_number, company_id)
        DO UPDATE SET
          quantity_received = item_batches.quantity_received + EXCLUDED.quantity_received,
          quantity_remaining = item_batches.quantity_remaining + EXCLUDED.quantity_received,
          updated_at = NOW();
      END IF;

      -- Rejected → quarantine (segregated, not issuable).
      IF COALESCE(gi.quantity_rejected, 0) > 0 THEN
        INSERT INTO public.item_batches (
          warehouse_item_id, batch_number, manufacturing_date, expiry_date,
          quantity_received, quantity_remaining, unit_cost, grn_item_id, company_id,
          status, notes
        ) VALUES (
          gi.warehouse_item_id,
          COALESCE(gi.batch_number, 'BATCH-' || to_char(NOW(), 'YYYYMMDD-HH24MISS') || '-' || SUBSTRING(gi.id::text, 1, 8)) || '-QTN',
          gi.manufacturing_date, gi.expiry_date,
          gi.quantity_rejected, gi.quantity_rejected,
          COALESCE(gi.net_unit_price, gi.unit_price),
          gi.id, NEW.company_id, 'quarantine',
          'Rejected on GRN ' || COALESCE(NEW.grn_number, '') ||
            ' — ' || COALESCE(gi.rejection_reason::text, 'unspecified') ||
            COALESCE(': ' || gi.rejection_notes, '')
        )
        ON CONFLICT (warehouse_item_id, batch_number, company_id)
        DO UPDATE SET
          quantity_received = item_batches.quantity_received + EXCLUDED.quantity_received,
          quantity_remaining = item_batches.quantity_remaining + EXCLUDED.quantity_received,
          updated_at = NOW();
      END IF;
    END LOOP;
  END IF;

  RETURN NEW;
END;
$$;
