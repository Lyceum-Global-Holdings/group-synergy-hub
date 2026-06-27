-- GRN discounts (landed cost): per-line discount (percent|fixed) + an overall
-- document discount allocated proportionally to lines, so the NET landed unit
-- cost (net_unit_price) flows into inventory valuation. IAS 2 — trade discounts
-- reduce inventory cost.
--
-- unit_price stays = gross. total_cost is repurposed to the FINAL net line value
-- (after line + allocated overall discount); net_unit_price = total_cost / qty.

-- ── Columns ──────────────────────────────────────────────────────────────────
ALTER TABLE public.grn_items
  ADD COLUMN IF NOT EXISTS discount_type text CHECK (discount_type IN ('percent','fixed')),
  ADD COLUMN IF NOT EXISTS discount_value numeric(15,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS line_discount_amount numeric(15,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS net_unit_price numeric(15,6);

ALTER TABLE public.goods_receipt_notes
  ADD COLUMN IF NOT EXISTS discount_type text CHECK (discount_type IN ('percent','fixed')),
  ADD COLUMN IF NOT EXISTS discount_value numeric(15,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS discount_amount numeric(15,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS subtotal_value numeric(15,2) NOT NULL DEFAULT 0;

ALTER TABLE public.warehouse_item_price_history
  ADD COLUMN IF NOT EXISTS net_unit_price numeric(15,6),
  ADD COLUMN IF NOT EXISTS line_discount_amount numeric(15,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS document_discount_amount numeric(15,2) NOT NULL DEFAULT 0;

-- ── recompute_grn_totals: the authoritative costing engine ───────────────────
CREATE OR REPLACE FUNCTION public.recompute_grn_totals(p_grn_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_dtype      text;
  v_dval       numeric;
  v_ids        uuid[]    := '{}';
  v_qtys       numeric[] := '{}';
  v_nets       numeric[] := '{}';
  v_subtotal   numeric   := 0;
  v_after_line numeric   := 0;
  v_doc_disc   numeric   := 0;
  v_alloc_sum  numeric   := 0;
  r            record;
  i            int;
  n            int;
  v_alloc      numeric;
  v_final      numeric;
BEGIN
  SELECT discount_type, COALESCE(discount_value, 0) INTO v_dtype, v_dval
    FROM public.goods_receipt_notes WHERE id = p_grn_id;

  -- Pass 1: line gross, line discount, line net (document order).
  FOR r IN
    SELECT id, COALESCE(quantity_received, 0) AS qty, COALESCE(unit_price, 0) AS up,
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

  -- Overall discount on the after-line subtotal.
  v_doc_disc := CASE v_dtype WHEN 'percent' THEN v_after_line * v_dval / 100
                             WHEN 'fixed'   THEN v_dval ELSE 0 END;
  v_doc_disc := LEAST(GREATEST(v_doc_disc, 0), v_after_line);

  -- Pass 2: allocate the overall discount proportionally; last line takes the
  -- rounding remainder so the allocations reconcile exactly.
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

  UPDATE public.goods_receipt_notes
     SET subtotal_value  = ROUND(v_subtotal, 2),
         discount_amount = ROUND(v_doc_disc, 2),
         total_value     = ROUND(v_after_line - v_doc_disc, 2),
         updated_at      = now()
   WHERE id = p_grn_id;
END;
$$;

-- Trigger wrappers (recompute writes only non-watched columns → no recursion).
CREATE OR REPLACE FUNCTION public.trg_grn_recompute_from_items()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  PERFORM public.recompute_grn_totals(COALESCE(NEW.grn_id, OLD.grn_id));
  RETURN COALESCE(NEW, OLD);
END;
$$;

CREATE OR REPLACE FUNCTION public.trg_grn_recompute_from_header()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  PERFORM public.recompute_grn_totals(NEW.id);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS update_grn_total_trigger ON public.grn_items;
DROP TRIGGER IF EXISTS trg_grn_items_recompute ON public.grn_items;
CREATE TRIGGER trg_grn_items_recompute
  AFTER INSERT OR DELETE OR UPDATE OF quantity_received, unit_price, discount_type, discount_value
  ON public.grn_items
  FOR EACH ROW EXECUTE FUNCTION public.trg_grn_recompute_from_items();

DROP TRIGGER IF EXISTS trg_grn_header_recompute ON public.goods_receipt_notes;
CREATE TRIGGER trg_grn_header_recompute
  AFTER UPDATE OF discount_type, discount_value ON public.goods_receipt_notes
  FOR EACH ROW EXECUTE FUNCTION public.trg_grn_recompute_from_header();

-- Backfill existing rows (no discounts → net = gross).
UPDATE public.grn_items SET net_unit_price = COALESCE(net_unit_price, unit_price)
 WHERE net_unit_price IS NULL;
UPDATE public.goods_receipt_notes SET subtotal_value = COALESCE(total_value, 0)
 WHERE subtotal_value = 0;

-- ── Cost propagation: stock ledger uses the net landed cost ───────────────────
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
  v_total_received numeric;
  v_total_allocated numeric;
  v_secondary_total numeric;
  v_secondary_delta numeric;
  v_unit_cost numeric;
  v_item_name text;
  v_secondary_uom text;
  v_allocation_count int := 0;
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

  -- Validate allocation totals per line.
  FOR v_line IN
    SELECT warehouse_item_id, item_name, quantity_received
    FROM public.grn_items
    WHERE grn_id = p_grn_id
      AND COALESCE(quality_status, 'good') = 'good'
      AND COALESCE(quantity_received, 0) > 0
  LOOP
    SELECT COALESCE(SUM((a->>'quantity')::numeric), 0) INTO v_total_allocated
    FROM jsonb_array_elements(COALESCE(p_allocations, '[]'::jsonb)) a
    WHERE (a->>'warehouse_item_id')::uuid = v_line.warehouse_item_id;

    IF v_total_allocated <> v_line.quantity_received THEN
      RAISE EXCEPTION 'GRN line "%" must be fully allocated to bins (received %, allocated %) [ISO 9001 §8.5.4]',
        v_line.item_name, v_line.quantity_received, v_total_allocated;
    END IF;
  END LOOP;

  PERFORM set_config('app.grn_allocating', '1', true);

  -- Per allocation: post the ledger row FIRST (trigger snapshots qty_before
  -- from the live bin allocation), THEN upsert the allocation.
  FOR v_alloc IN
    SELECT (a->>'warehouse_item_id')::uuid AS warehouse_item_id,
           (a->>'bin_id')::uuid AS bin_id,
           NULLIF(a->>'location_id','')::uuid AS location_id,
           (a->>'quantity')::numeric AS quantity
    FROM jsonb_array_elements(COALESCE(p_allocations, '[]'::jsonb)) a
  LOOP
    IF v_alloc.warehouse_item_id IS NULL OR v_alloc.bin_id IS NULL
       OR COALESCE(v_alloc.quantity, 0) <= 0 THEN
      CONTINUE;
    END IF;

    v_alloc_location := v_alloc.location_id;
    IF v_alloc_location IS NULL THEN
      SELECT COALESCE(root_location_id, location_id) INTO v_alloc_location
      FROM public.warehouse_bins WHERE id = v_alloc.bin_id;
    END IF;

    -- Use the NET landed unit cost (after line + allocated overall discount).
    SELECT secondary_quantity_received, quantity_received, COALESCE(net_unit_price, unit_price), item_name, secondary_uom
      INTO v_secondary_total, v_total_received, v_unit_cost, v_item_name, v_secondary_uom
    FROM public.grn_items
    WHERE grn_id = p_grn_id AND warehouse_item_id = v_alloc.warehouse_item_id
    LIMIT 1;

    v_secondary_delta := NULL;
    IF v_secondary_total IS NOT NULL AND COALESCE(v_total_received,0) > 0 THEN
      v_secondary_delta := v_secondary_total * v_alloc.quantity / v_total_received;
    END IF;

    -- STEP 1: Ledger row (trigger fills qty_before/qty_after from live alloc).
    INSERT INTO public.stock_transactions(
      item_id, transaction_type, reference_type, reference_id,
      quantity_change, quantity_before, quantity_after,
      unit_cost, total_value, notes, company_id, created_by,
      bin_id, location_id,
      secondary_quantity_change, secondary_uom
    ) VALUES (
      v_alloc.warehouse_item_id, 'goods_receipt', 'grn', p_grn_id,
      v_alloc.quantity, 0, 0,
      v_unit_cost, COALESCE(v_unit_cost,0) * v_alloc.quantity,
      'GRN ' || COALESCE(v_grn_number,'') || ' - ' || COALESCE(v_item_name,''),
      v_company, v_user,
      v_alloc.bin_id, v_alloc_location,
      v_secondary_delta, v_secondary_uom
    );

    -- STEP 2: Upsert bin allocation to match the ledger.
    SELECT id INTO v_existing
    FROM public.warehouse_bin_allocations
    WHERE warehouse_item_id = v_alloc.warehouse_item_id
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
        v_alloc.warehouse_item_id, v_alloc.bin_id, v_alloc_location, v_alloc.quantity,
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

  RETURN jsonb_build_object('grn_id', p_grn_id, 'allocations', v_allocation_count);
END;
$$;

-- Sync the standing item cost + price history to the NET landed cost.
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
      AND COALESCE(gi.quality_status, 'good') <> 'rejected'
      AND COALESCE(gi.quantity_received, 0) > 0
    ORDER BY gi.created_at ASC, gi.id ASC
  LOOP
    v_net := COALESCE(v_item.net_unit_price, v_item.unit_price, 0);
    -- Allocated overall discount on this line = line_net - final_net.
    v_doc_disc := GREATEST(0,
      (COALESCE(v_item.unit_price,0) * COALESCE(v_item.quantity_received,0)
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
      v_net,
      v_net,
      COALESCE(v_item.line_discount_amount, 0),
      ROUND(v_doc_disc, 2),
      COALESCE(v_item.quantity_received, 0),
      COALESCE(v_item.total_cost, v_net * COALESCE(v_item.quantity_received,0)),
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

GRANT EXECUTE ON FUNCTION public.recompute_grn_totals(uuid) TO authenticated;
