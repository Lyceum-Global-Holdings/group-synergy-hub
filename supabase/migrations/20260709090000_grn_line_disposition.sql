-- Per-line GRN disposition: accept N / reject M per line (ISO 9001 §8.6/§8.7, GS1 RECADV).
--
-- Until now a GRN was accepted or rejected as a whole: `grn_items.quality_status`
-- is a whole-line flag that cannot express "accept 5 of 7", and the reason enum
-- (`grn_rejection_reason`) lived only on the header. This adds an accepted/rejected
-- quantity split with a per-line reason code, posts stock for the accepted quantity
-- only, and segregates the rejected quantity as quarantine stock.
--
-- It also repairs three defects on this code path that per-line rejection would
-- otherwise turn from rare into constant (see sections 3, 5, 6).

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. Line disposition columns. `inspected_by/at` is the ISO 9001 §8.7 record of
--    "the authority deciding the action".
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.grn_items
  ADD COLUMN IF NOT EXISTS quantity_accepted numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS quantity_rejected numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS rejection_reason  public.grn_rejection_reason,
  ADD COLUMN IF NOT EXISTS rejection_notes   text,
  ADD COLUMN IF NOT EXISTS inspected_by      uuid,
  ADD COLUMN IF NOT EXISTS inspected_at      timestamptz;

-- Backfill from the legacy whole-line flag so the CHECK below validates.
UPDATE public.grn_items
   SET quantity_accepted = CASE WHEN COALESCE(quality_status, 'good') = 'good'
                                THEN COALESCE(quantity_received, 0) ELSE 0 END,
       quantity_rejected = CASE WHEN COALESCE(quality_status, 'good') = 'good'
                                THEN 0 ELSE COALESCE(quantity_received, 0) END
 WHERE quantity_accepted = 0 AND quantity_rejected = 0;

ALTER TABLE public.grn_items DROP CONSTRAINT IF EXISTS grn_items_disposition_split_check;
ALTER TABLE public.grn_items
  ADD CONSTRAINT grn_items_disposition_split_check
  CHECK (quantity_accepted >= 0
     AND quantity_rejected >= 0
     AND quantity_accepted + quantity_rejected = COALESCE(quantity_received, 0));

-- Reason-required is enforced in set_grn_item_disposition (mirroring the header
-- trigger), NOT as a CHECK — legacy non-good lines have no reason and must not
-- block this migration.

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. Derive the split from the receipt-time quality flag until someone inspects
--    the line. Without this a new line would default to accepted=0 and price at
--    zero; and a line marked damaged/rejected at receipt must NOT be presumed
--    accepted (that is the §8.6 defect this migration exists to close).
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.grn_items_sync_disposition()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
DECLARE
  v_good boolean;
BEGIN
  v_good := COALESCE(NEW.quality_status, 'good') = 'good';

  IF TG_OP = 'INSERT' THEN
    IF COALESCE(NEW.quantity_accepted, 0) = 0 AND COALESCE(NEW.quantity_rejected, 0) = 0 THEN
      NEW.quantity_accepted := CASE WHEN v_good THEN COALESCE(NEW.quantity_received, 0) ELSE 0 END;
      NEW.quantity_rejected := CASE WHEN v_good THEN 0 ELSE COALESCE(NEW.quantity_received, 0) END;
    END IF;
  ELSIF TG_OP = 'UPDATE' THEN
    -- Received qty or the quality flag changed on a line nobody has inspected →
    -- keep the split in sync (covers the draft delete+reinsert edit path).
    IF (NEW.quantity_received IS DISTINCT FROM OLD.quantity_received
        OR NEW.quality_status IS DISTINCT FROM OLD.quality_status)
       AND NEW.inspected_at IS NULL THEN
      NEW.quantity_accepted := CASE WHEN v_good THEN COALESCE(NEW.quantity_received, 0) ELSE 0 END;
      NEW.quantity_rejected := CASE WHEN v_good THEN 0 ELSE COALESCE(NEW.quantity_received, 0) END;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_grn_items_sync_disposition ON public.grn_items;
CREATE TRIGGER trg_grn_items_sync_disposition
  BEFORE INSERT OR UPDATE ON public.grn_items
  FOR EACH ROW EXECUTE FUNCTION public.grn_items_sync_disposition();

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. FIX: update_stock_on_grn_approval had no quality filter, so damaged/rejected
--    lines inflated warehouse_items.current_stock with no allocation or ledger
--    row. It also used UPDATE..FROM, which silently applies only ONE matching
--    grn_items row per item. Aggregate, and count accepted qty only.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.update_stock_on_grn_approval()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.status = 'approved' AND (OLD.status IS NULL OR OLD.status <> 'approved') THEN
    UPDATE public.warehouse_items wi
       SET current_stock = COALESCE(wi.current_stock, 0) + agg.qty,
           updated_at = now()
      FROM (
        SELECT warehouse_item_id, SUM(COALESCE(quantity_accepted, 0)) AS qty
        FROM public.grn_items
        WHERE grn_id = NEW.id AND warehouse_item_id IS NOT NULL
        GROUP BY warehouse_item_id
        HAVING SUM(COALESCE(quantity_accepted, 0)) > 0
      ) agg
     WHERE wi.id = agg.warehouse_item_id;
  END IF;
  RETURN NEW;
END;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. Costing follows ACCEPTED quantity (3-way match: rejected goods are never
--    payable). Only the billable-quantity source changes; the two-pass discount
--    /tax/transport algorithm is untouched.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.recompute_grn_totals(p_grn_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_dtype      text;
  v_dval       numeric;
  v_ttype      text;
  v_tval       numeric;
  v_transport  numeric   := 0;
  v_ids        uuid[]    := '{}';
  v_qtys       numeric[] := '{}';
  v_nets       numeric[] := '{}';
  v_subtotal   numeric   := 0;
  v_after_line numeric   := 0;
  v_doc_disc   numeric   := 0;
  v_alloc_sum  numeric   := 0;
  v_net_total  numeric   := 0;
  v_tax        numeric   := 0;
  r            record;
  i            int;
  n            int;
  v_alloc      numeric;
  v_final      numeric;
BEGIN
  SELECT discount_type, COALESCE(discount_value, 0),
         tax_type, COALESCE(tax_value, 0), COALESCE(transport_cost, 0)
    INTO v_dtype, v_dval, v_ttype, v_tval, v_transport
    FROM public.goods_receipt_notes WHERE id = p_grn_id;

  -- Pass 1: line gross, line discount, line net — billed on ACCEPTED qty.
  FOR r IN
    SELECT id, COALESCE(quantity_accepted, 0) AS qty, COALESCE(unit_price, 0) AS up,
           discount_type AS ld_type, COALESCE(discount_value, 0) AS ld_val
    FROM public.grn_items WHERE grn_id = p_grn_id
    ORDER BY created_at, id
  LOOP
    DECLARE
      g  numeric := r.qty * r.up;
      ld numeric;
      ln numeric;
    BEGIN
      ld := CASE r.ld_type WHEN 'percent' THEN g * r.ld_val / 100
                           WHEN 'fixed'   THEN r.ld_val ELSE 0 END;
      ld := LEAST(GREATEST(ld, 0), g);
      ln := g - ld;
      UPDATE public.grn_items SET line_discount_amount = ROUND(ld, 2) WHERE id = r.id;
      v_ids := v_ids || r.id; v_qtys := v_qtys || r.qty; v_nets := v_nets || ln;
      v_subtotal := v_subtotal + g; v_after_line := v_after_line + ln;
    END;
  END LOOP;

  v_doc_disc := CASE v_dtype WHEN 'percent' THEN v_after_line * v_dval / 100
                             WHEN 'fixed'   THEN v_dval ELSE 0 END;
  v_doc_disc := LEAST(GREATEST(v_doc_disc, 0), v_after_line);

  n := array_length(v_ids, 1);
  IF n IS NOT NULL THEN
    FOR i IN 1..n LOOP
      IF i < n AND v_after_line > 0 THEN
        v_alloc := ROUND(v_doc_disc * v_nets[i] / v_after_line, 2);
      ELSIF i = n THEN
        v_alloc := ROUND(v_doc_disc - v_alloc_sum, 2);
      ELSE
        v_alloc := 0;
      END IF;
      v_alloc_sum := v_alloc_sum + v_alloc;
      v_final := ROUND(v_nets[i] - v_alloc, 2);
      UPDATE public.grn_items
         SET total_cost     = v_final,
             net_unit_price = CASE WHEN v_qtys[i] > 0 THEN ROUND(v_final / v_qtys[i], 6) ELSE 0 END,
             updated_at     = now()
       WHERE id = v_ids[i];
    END LOOP;
  END IF;

  v_net_total := ROUND(v_after_line - v_doc_disc, 2);
  v_tax := CASE v_ttype WHEN 'percent' THEN v_net_total * v_tval / 100
                        WHEN 'fixed'   THEN v_tval ELSE 0 END;
  v_tax := GREATEST(v_tax, 0);
  v_transport := GREATEST(v_transport, 0);

  UPDATE public.goods_receipt_notes
     SET subtotal_value  = ROUND(v_subtotal, 2),
         discount_amount = ROUND(v_doc_disc, 2),
         total_value     = v_net_total,
         tax_amount      = ROUND(v_tax, 2),
         grand_total     = ROUND(v_net_total + v_tax + v_transport, 2),
         updated_at      = now()
   WHERE id = p_grn_id;
END;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 5. Record a line's inspection outcome. Reason/notes rules mirror the header
--    rejection trigger. quality_status is kept in sync so existing badges and
--    filters stay meaningful: none rejected → good, all rejected → rejected,
--    partial → damaged.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.set_grn_item_disposition(
  p_grn_item_id uuid,
  p_qty_accepted numeric,
  p_qty_rejected numeric,
  p_reason public.grn_rejection_reason DEFAULT NULL,
  p_notes text DEFAULT NULL
) RETURNS public.grn_items
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_line public.grn_items;
  v_grn  record;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;
  IF NOT public.is_admin(v_user) THEN
    RAISE EXCEPTION 'Only admins can inspect GRN lines';
  END IF;

  SELECT * INTO v_line FROM public.grn_items WHERE id = p_grn_item_id FOR UPDATE;
  IF v_line IS NULL THEN
    RAISE EXCEPTION 'GRN line % not found', p_grn_item_id;
  END IF;

  SELECT id, status, company_id INTO v_grn
  FROM public.goods_receipt_notes WHERE id = v_line.grn_id FOR UPDATE;

  IF v_grn.status NOT IN ('submitted', 'draft') THEN
    RAISE EXCEPTION 'GRN must be in submitted/draft status to inspect lines (current: %)', v_grn.status;
  END IF;
  IF NOT public.can_access_company(v_grn.company_id) THEN
    RAISE EXCEPTION 'Not authorised for this GRN';
  END IF;

  IF COALESCE(p_qty_accepted, 0) < 0 OR COALESCE(p_qty_rejected, 0) < 0 THEN
    RAISE EXCEPTION 'Quantities cannot be negative';
  END IF;
  IF COALESCE(p_qty_accepted, 0) + COALESCE(p_qty_rejected, 0)
       <> COALESCE(v_line.quantity_received, 0) THEN
    RAISE EXCEPTION 'Accepted (%) + rejected (%) must equal received (%) for line "%"',
      p_qty_accepted, p_qty_rejected, v_line.quantity_received, v_line.item_name;
  END IF;
  IF COALESCE(p_qty_rejected, 0) > 0 AND p_reason IS NULL THEN
    RAISE EXCEPTION 'A rejection reason is required when rejecting quantity [ISO 9001 §8.7]';
  END IF;
  IF p_reason = 'other' AND COALESCE(btrim(p_notes), '') = '' THEN
    RAISE EXCEPTION 'Notes are required when the rejection reason is "other"';
  END IF;

  UPDATE public.grn_items
     SET quantity_accepted = COALESCE(p_qty_accepted, 0),
         quantity_rejected = COALESCE(p_qty_rejected, 0),
         rejection_reason  = CASE WHEN COALESCE(p_qty_rejected,0) > 0 THEN p_reason ELSE NULL END,
         rejection_notes   = CASE WHEN COALESCE(p_qty_rejected,0) > 0 THEN NULLIF(btrim(p_notes),'') ELSE NULL END,
         quality_status    = CASE
                               WHEN COALESCE(p_qty_rejected,0) = 0 THEN 'good'
                               WHEN COALESCE(p_qty_accepted,0) = 0 THEN 'rejected'
                               ELSE 'damaged' END,
         inspected_by      = v_user,
         inspected_at      = now(),
         updated_at        = now()
   WHERE id = p_grn_item_id
   RETURNING * INTO v_line;

  PERFORM public.recompute_grn_totals(v_line.grn_id);
  RETURN v_line;
END;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 6. Approval: allocate + post the ACCEPTED quantity only, keyed by grn_item_id.
--    FIX: allocations were keyed by warehouse_item_id, so two lines of the same
--    item (e.g. different batches) mis-validated and mis-costed. FIX: the posting
--    loop was unfiltered while validation filtered 'good', so rejected goods
--    could still post stock (violating ISO 9001 §8.6).
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.approve_grn_with_allocations(
  p_grn_id uuid,
  p_allocations jsonb
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_company uuid;
  v_status text;
  v_grn_number text;
  v_line record;
  v_alloc record;
  v_target_item uuid;
  v_existing uuid;
  v_alloc_location uuid;
  v_total_allocated numeric;
  v_secondary_total numeric;
  v_secondary_delta numeric;
  v_accepted numeric;
  v_unit_cost numeric;
  v_item_name text;
  v_secondary_uom text;
  v_allocation_count int := 0;
  v_total_accepted numeric;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;
  IF NOT public.is_admin(v_user) THEN
    RAISE EXCEPTION 'Only admins can approve GRNs';
  END IF;
  IF p_grn_id IS NULL THEN
    RAISE EXCEPTION 'p_grn_id is required';
  END IF;

  SELECT company_id, status, grn_number
    INTO v_company, v_status, v_grn_number
  FROM public.goods_receipt_notes
  WHERE id = p_grn_id
  FOR UPDATE;

  IF v_company IS NULL THEN
    RAISE EXCEPTION 'GRN % not found', p_grn_id;
  END IF;
  IF v_status NOT IN ('submitted','draft') THEN
    RAISE EXCEPTION 'GRN must be in submitted/draft status (current: %)', v_status;
  END IF;

  -- A wholly-rejected GRN is a header rejection: it needs a header reason and is
  -- terminal, which reject_goods_receipt_note already enforces.
  SELECT COALESCE(SUM(quantity_accepted), 0) INTO v_total_accepted
  FROM public.grn_items WHERE grn_id = p_grn_id;
  IF v_total_accepted <= 0 THEN
    RAISE EXCEPTION 'Every line is rejected — use Reject GRN to record a header reason [ISO 9001 §8.7]';
  END IF;

  -- Resolve warehouse_item_id for any line missing one.
  FOR v_line IN
    SELECT id, warehouse_item_id, catalog_item_id, item_code, item_name
    FROM public.grn_items
    WHERE grn_id = p_grn_id
  LOOP
    IF v_line.warehouse_item_id IS NULL THEN
      v_target_item := NULL;
      IF v_line.catalog_item_id IS NOT NULL THEN
        v_target_item := public.ensure_warehouse_item_for_company(v_company, v_line.catalog_item_id);
      ELSIF v_line.item_code IS NOT NULL THEN
        SELECT id INTO v_target_item
          FROM public.warehouse_items
         WHERE company_id = v_company AND item_code = v_line.item_code
         LIMIT 1;
        IF v_target_item IS NULL THEN
          SELECT public.ensure_warehouse_item_for_company(v_company, c.id) INTO v_target_item
          FROM public.warehouse_item_catalog c
          WHERE c.item_code = v_line.item_code
          LIMIT 1;
        END IF;
      END IF;
      IF v_target_item IS NULL THEN
        RAISE EXCEPTION 'Cannot resolve warehouse item for GRN line "%" — link it before approval', v_line.item_name;
      END IF;
      UPDATE public.grn_items SET warehouse_item_id = v_target_item WHERE id = v_line.id;
    END IF;
  END LOOP;

  -- Validate allocation totals per LINE against the ACCEPTED quantity.
  FOR v_line IN
    SELECT id, item_name, quantity_accepted
    FROM public.grn_items
    WHERE grn_id = p_grn_id
      AND COALESCE(quantity_accepted, 0) > 0
  LOOP
    SELECT COALESCE(SUM((a->>'quantity')::numeric), 0) INTO v_total_allocated
    FROM jsonb_array_elements(COALESCE(p_allocations, '[]'::jsonb)) a
    WHERE NULLIF(a->>'grn_item_id','')::uuid = v_line.id;

    IF v_total_allocated <> v_line.quantity_accepted THEN
      RAISE EXCEPTION 'GRN line "%" must be fully allocated to bins (accepted %, allocated %) [ISO 9001 §8.5.4]',
        v_line.item_name, v_line.quantity_accepted, v_total_allocated;
    END IF;
  END LOOP;

  PERFORM set_config('app.grn_allocating', '1', true);

  FOR v_alloc IN
    SELECT NULLIF(a->>'grn_item_id','')::uuid AS grn_item_id,
           (a->>'bin_id')::uuid AS bin_id,
           NULLIF(a->>'location_id','')::uuid AS location_id,
           (a->>'quantity')::numeric AS quantity
    FROM jsonb_array_elements(COALESCE(p_allocations, '[]'::jsonb)) a
  LOOP
    IF v_alloc.grn_item_id IS NULL OR v_alloc.bin_id IS NULL
       OR COALESCE(v_alloc.quantity, 0) <= 0 THEN
      CONTINUE;
    END IF;

    -- Line-scoped lookup (was keyed by warehouse_item_id + LIMIT 1).
    SELECT warehouse_item_id, secondary_quantity_received, quantity_accepted,
           COALESCE(net_unit_price, unit_price), item_name, secondary_uom
      INTO v_target_item, v_secondary_total, v_accepted, v_unit_cost, v_item_name, v_secondary_uom
    FROM public.grn_items
    WHERE id = v_alloc.grn_item_id AND grn_id = p_grn_id;

    IF v_target_item IS NULL THEN
      RAISE EXCEPTION 'Allocation references a line that is not on this GRN';
    END IF;

    v_alloc_location := v_alloc.location_id;
    IF v_alloc_location IS NULL THEN
      SELECT COALESCE(root_location_id, location_id) INTO v_alloc_location
      FROM public.warehouse_bins WHERE id = v_alloc.bin_id;
    END IF;

    -- Prorate the secondary UOM against the ACCEPTED quantity.
    v_secondary_delta := NULL;
    IF v_secondary_total IS NOT NULL AND COALESCE(v_accepted, 0) > 0 THEN
      v_secondary_delta := v_secondary_total * v_alloc.quantity / v_accepted;
    END IF;

    INSERT INTO public.stock_transactions(
      item_id, transaction_type, reference_type, reference_id,
      quantity_change, quantity_before, quantity_after,
      unit_cost, total_value, notes, company_id, created_by,
      bin_id, location_id,
      secondary_quantity_change, secondary_uom
    ) VALUES (
      v_target_item, 'goods_receipt', 'grn', p_grn_id,
      v_alloc.quantity, 0, 0,
      v_unit_cost, COALESCE(v_unit_cost,0) * v_alloc.quantity,
      'GRN ' || COALESCE(v_grn_number,'') || ' - ' || COALESCE(v_item_name,''),
      v_company, v_user,
      v_alloc.bin_id, v_alloc_location,
      v_secondary_delta, v_secondary_uom
    );

    SELECT id INTO v_existing
    FROM public.warehouse_bin_allocations
    WHERE warehouse_item_id = v_target_item
      AND bin_id = v_alloc.bin_id
      AND company_id = v_company
      AND ((location_id IS NULL AND v_alloc_location IS NULL) OR location_id = v_alloc_location)
    LIMIT 1;

    IF v_existing IS NOT NULL THEN
      UPDATE public.warehouse_bin_allocations
         SET allocated_quantity = COALESCE(allocated_quantity,0) + v_alloc.quantity,
             secondary_quantity = CASE
               WHEN v_secondary_delta IS NOT NULL
                 THEN COALESCE(secondary_quantity,0) + v_secondary_delta
               ELSE secondary_quantity END,
             updated_at = now()
       WHERE id = v_existing;
    ELSE
      INSERT INTO public.warehouse_bin_allocations(
        warehouse_item_id, bin_id, location_id, allocated_quantity,
        secondary_quantity, company_id, created_by
      ) VALUES (
        v_target_item, v_alloc.bin_id, v_alloc_location, v_alloc.quantity,
        v_secondary_delta, v_company, v_user
      );
    END IF;

    v_allocation_count := v_allocation_count + 1;
  END LOOP;

  UPDATE public.goods_receipt_notes
     SET status = 'approved',
         approved_by = v_user,
         approved_date = now()
   WHERE id = p_grn_id;

  RETURN jsonb_build_object(
    'grn_id', p_grn_id,
    'allocations', v_allocation_count,
    'accepted', v_total_accepted,
    'rejected', (SELECT COALESCE(SUM(quantity_rejected),0) FROM public.grn_items WHERE grn_id = p_grn_id)
  );
END;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 7. Batches: accepted qty → 'active'; rejected qty → 'quarantine' (§8.7
--    segregation — quarantine stock is never issuable). The quarantine row takes
--    a "-QTN" batch suffix so it cannot collide with, or be merged into, the
--    accepted batch via the UNIQUE(warehouse_item_id, batch_number, company_id).
--    Lines are selected on quantity_accepted/rejected, not quality_status, so a
--    partially-accepted line still yields its accepted batch.
-- ─────────────────────────────────────────────────────────────────────────────
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
    WHERE gi.grn_id = NEW.id
      AND COALESCE(gi.quantity_accepted, 0) > 0
      AND wi.is_batch_tracked = true
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
    WHERE gi.grn_id = NEW.id
      AND COALESCE(gi.quantity_rejected, 0) > 0
      AND wi.is_batch_tracked = true
    ON CONFLICT (warehouse_item_id, batch_number, company_id)
    DO UPDATE SET
      quantity_received = item_batches.quantity_received + EXCLUDED.quantity_received,
      quantity_remaining = item_batches.quantity_remaining + EXCLUDED.quantity_received,
      updated_at = NOW();
  END IF;

  RETURN NEW;
END;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 8. PO fulfilment counts ACCEPTED quantity (rejected goods don't fulfil a PO).
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.update_po_quantities_on_grn_approval()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'approved' AND (OLD.status IS NULL OR OLD.status != 'approved') THEN
    UPDATE public.po_items poi
       SET quantity_received = poi.quantity_received + agg.qty,
           quantity_pending  = poi.quantity_ordered - (poi.quantity_received + agg.qty),
           updated_at = now()
      FROM (
        SELECT po_item_id, SUM(COALESCE(quantity_accepted, 0)) AS qty
        FROM public.grn_items
        WHERE grn_id = NEW.id AND po_item_id IS NOT NULL
        GROUP BY po_item_id
        HAVING SUM(COALESCE(quantity_accepted, 0)) > 0
      ) agg
     WHERE agg.po_item_id = poi.id;

    UPDATE public.purchase_orders
       SET status = CASE
             WHEN (SELECT COALESCE(SUM(quantity_pending), 0) FROM public.po_items WHERE po_id = NEW.po_id) = 0
               THEN 'completed'
             WHEN (SELECT COALESCE(SUM(quantity_received), 0) FROM public.po_items WHERE po_id = NEW.po_id) > 0
               THEN 'partially_received'
             ELSE status END,
           updated_at = now()
     WHERE id = NEW.po_id;
  END IF;

  RETURN NEW;
END;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 9. Price history / standing cost follows accepted lines (was quality_status).
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.sync_item_price_on_grn_approval()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_item RECORD;
  v_received_at timestamptz := COALESCE(NEW.approved_date, now());
  v_net numeric;
  v_doc_disc numeric;
BEGIN
  IF NEW.status NOT IN ('approved','completed') THEN
    RETURN NEW;
  END IF;
  IF OLD.status = NEW.status THEN
    RETURN NEW;
  END IF;

  FOR v_item IN
    SELECT gi.*
    FROM public.grn_items gi
    WHERE gi.grn_id = NEW.id
      AND COALESCE(gi.quantity_accepted, 0) > 0
    ORDER BY gi.created_at ASC, gi.id ASC
  LOOP
    v_net := COALESCE(v_item.net_unit_price, v_item.unit_price, 0);
    v_doc_disc := GREATEST(0,
      (COALESCE(v_item.unit_price,0) * COALESCE(v_item.quantity_accepted,0)
        - COALESCE(v_item.line_discount_amount,0))
      - COALESCE(v_item.total_cost, 0));

    INSERT INTO public.warehouse_item_price_history (
      catalog_item_id, warehouse_item_id, company_id,
      grn_id, grn_item_id, grn_number, grn_date,
      po_id, po_number,
      supplier_id, supplier_name,
      unit_price, net_unit_price, line_discount_amount, document_discount_amount,
      quantity_received, total_cost,
      received_at, created_by
    ) VALUES (
      v_item.catalog_item_id, v_item.warehouse_item_id, NEW.company_id,
      NEW.id, v_item.id, NEW.grn_number, NEW.grn_date,
      NEW.po_id, NEW.po_number,
      NEW.supplier_id, NEW.supplier_name,
      v_net, v_net,
      COALESCE(v_item.line_discount_amount, 0),
      ROUND(v_doc_disc, 2),
      COALESCE(v_item.quantity_accepted, 0),
      COALESCE(v_item.total_cost, v_net * COALESCE(v_item.quantity_accepted,0)),
      v_received_at,
      NEW.approved_by
    )
    ON CONFLICT (grn_item_id) DO NOTHING;

    IF v_item.catalog_item_id IS NOT NULL AND v_net > 0 THEN
      UPDATE public.warehouse_item_catalog
        SET unit_cost                 = v_net,
            last_purchase_price       = v_net,
            last_purchase_date        = v_received_at,
            last_purchase_supplier_id = NEW.supplier_id,
            last_purchase_grn_id      = NEW.id,
            updated_at                = now()
        WHERE id = v_item.catalog_item_id;
    END IF;

    IF v_item.catalog_item_id IS NOT NULL AND NEW.company_id IS NOT NULL AND v_net > 0 THEN
      UPDATE public.warehouse_items
        SET unit_cost = v_net, updated_at = now()
        WHERE catalog_item_id = v_item.catalog_item_id
          AND company_id = NEW.company_id;
    END IF;
  END LOOP;

  RETURN NEW;
END;
$$;

-- Recompute every existing GRN so totals reflect the accepted-quantity basis.
DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT id FROM public.goods_receipt_notes LOOP
    PERFORM public.recompute_grn_totals(r.id);
  END LOOP;
END $$;

GRANT EXECUTE ON FUNCTION public.set_grn_item_disposition(uuid, numeric, numeric, public.grn_rejection_reason, text) TO authenticated;
