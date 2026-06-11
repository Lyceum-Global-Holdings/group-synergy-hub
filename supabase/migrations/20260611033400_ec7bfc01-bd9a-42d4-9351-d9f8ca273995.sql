
-- =====================================================================
-- GRN Quarantine / GR-Blocked-Stock workflow (ISO 9001 §8.6 / SAP MIGO)
--
-- 1. Add grn_items.catalog_item_id so inventory provisioning can be
--    deferred until approval.
-- 2. Atomic RPC approve_grn_with_allocations(p_grn_id, p_allocations)
--    that provisions warehouse_items, writes bin allocations, inserts
--    stock_transactions, and flips status to 'approved' in one tx.
-- 3. Guard trigger blocks any other path to 'approved'.
-- =====================================================================

-- 1. New nullable column linking GRN lines to the global catalog before
--    a per-company warehouse_items row exists.
ALTER TABLE public.grn_items
  ADD COLUMN IF NOT EXISTS catalog_item_id uuid REFERENCES public.warehouse_item_catalog(id);

CREATE INDEX IF NOT EXISTS idx_grn_items_catalog_item
  ON public.grn_items(catalog_item_id);

-- =====================================================================
-- 2. Atomic approve-and-allocate RPC
-- =====================================================================
CREATE OR REPLACE FUNCTION public.approve_grn_with_allocations(
  p_grn_id uuid,
  p_allocations jsonb  -- [{warehouse_item_id|grn_item_id, bin_id, location_id?, quantity}]
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
  v_qty_before numeric;
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

  -- Lock the GRN
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

  -- Resolve warehouse_item_id for any line that only has catalog_item_id / item_code.
  -- This is the ONLY path that may provision per-company inventory rows.
  FOR v_line IN
    SELECT id, warehouse_item_id, catalog_item_id, item_code, item_name,
           quantity_received, quality_status
    FROM public.grn_items
    WHERE grn_id = p_grn_id
  LOOP
    IF v_line.warehouse_item_id IS NULL THEN
      v_target_item := NULL;

      IF v_line.catalog_item_id IS NOT NULL THEN
        v_target_item := public.ensure_warehouse_item_for_company(v_company, v_line.catalog_item_id);
      ELSIF v_line.item_code IS NOT NULL THEN
        -- Try existing per-company row, else catalog lookup
        SELECT id INTO v_target_item
          FROM public.warehouse_items_full
         WHERE item_code = v_line.item_code
           AND (company_id = v_company OR company_id IS NULL)
         LIMIT 1;

        IF v_target_item IS NULL THEN
          SELECT public.ensure_warehouse_item_for_company(v_company, c.id)
            INTO v_target_item
          FROM public.warehouse_item_catalog c
          WHERE c.item_code = v_line.item_code
          LIMIT 1;
        END IF;
      END IF;

      IF v_target_item IS NULL THEN
        RAISE EXCEPTION 'Cannot resolve warehouse item for GRN line "%s" — link an item before approval', v_line.item_name;
      END IF;

      UPDATE public.grn_items
         SET warehouse_item_id = v_target_item
       WHERE id = v_line.id;
    END IF;
  END LOOP;

  -- Validate allocation totals per line for good-quality, positive-qty items
  FOR v_line IN
    SELECT id, warehouse_item_id, item_name, quantity_received, quality_status
    FROM public.grn_items
    WHERE grn_id = p_grn_id
      AND COALESCE(quality_status, 'good') = 'good'
      AND COALESCE(quantity_received, 0) > 0
  LOOP
    SELECT COALESCE(SUM((a->>'quantity')::numeric), 0)
      INTO v_total_allocated
    FROM jsonb_array_elements(COALESCE(p_allocations, '[]'::jsonb)) a
    WHERE (a->>'warehouse_item_id')::uuid = v_line.warehouse_item_id;

    IF v_total_allocated <> v_line.quantity_received THEN
      RAISE EXCEPTION 'GRN line "%" must be fully allocated to bins (received %, allocated %) [ISO 9001 §8.5.4]',
        v_line.item_name, v_line.quantity_received, v_total_allocated;
    END IF;
  END LOOP;

  -- Authorise the status flip for the guard trigger
  PERFORM set_config('app.grn_allocating', '1', true);

  -- Insert stock_transactions BEFORE flipping status so qty_before reflects pre-receipt state.
  -- (The status-flip trigger updates warehouse_items.current_stock; the ledger trigger
  -- on stock_transactions recomputes qty_before/after from live allocations.)
  FOR v_line IN
    SELECT gi.id, gi.warehouse_item_id, gi.quantity_received, gi.unit_price,
           gi.total_cost, gi.item_name,
           gi.secondary_quantity_received, gi.secondary_uom
    FROM public.grn_items gi
    WHERE gi.grn_id = p_grn_id
      AND COALESCE(gi.quality_status, 'good') = 'good'
      AND COALESCE(gi.quantity_received, 0) > 0
  LOOP
    -- Pick the first allocation row for bin/location reference (per-bin ledger
    -- rows are written below in the allocation loop if needed).
    SELECT (a->>'bin_id')::uuid, (a->>'location_id')::uuid
      INTO v_alloc_location, v_alloc_location  -- placeholder, overwritten below
    FROM jsonb_array_elements(COALESCE(p_allocations, '[]'::jsonb)) a
    WHERE (a->>'warehouse_item_id')::uuid = v_line.warehouse_item_id
    LIMIT 1;

    SELECT COALESCE(current_stock, 0) INTO v_qty_before
    FROM public.warehouse_items_full
    WHERE id = v_line.warehouse_item_id;

    -- Insert one stock_transactions row per allocation (location-scoped ledger).
    FOR v_alloc IN
      SELECT (a->>'bin_id')::uuid AS bin_id,
             (a->>'location_id')::uuid AS location_id,
             (a->>'quantity')::numeric AS quantity
      FROM jsonb_array_elements(COALESCE(p_allocations, '[]'::jsonb)) a
      WHERE (a->>'warehouse_item_id')::uuid = v_line.warehouse_item_id
    LOOP
      v_secondary_delta := NULL;
      IF v_line.secondary_quantity_received IS NOT NULL AND v_line.quantity_received > 0 THEN
        v_secondary_delta := v_line.secondary_quantity_received * v_alloc.quantity / v_line.quantity_received;
      END IF;

      INSERT INTO public.stock_transactions(
        item_id, transaction_type, reference_type, reference_id,
        quantity_change, quantity_before, quantity_after,
        unit_cost, total_value, notes, company_id, created_by,
        bin_id, location_id,
        secondary_quantity_change, secondary_uom
      ) VALUES (
        v_line.warehouse_item_id, 'goods_receipt', 'grn', p_grn_id,
        v_alloc.quantity, v_qty_before, v_qty_before + v_alloc.quantity,
        v_line.unit_price, v_line.unit_price * v_alloc.quantity,
        'GRN ' || COALESCE(v_grn_number,'') || ' - ' || COALESCE(v_line.item_name,''),
        v_company, v_user,
        v_alloc.bin_id, v_alloc.location_id,
        v_secondary_delta, v_line.secondary_uom
      );
    END LOOP;
  END LOOP;

  -- Upsert bin allocations
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
      SELECT COALESCE(root_location_id, location_id)
        INTO v_alloc_location
      FROM public.warehouse_bins
      WHERE id = v_alloc.bin_id;
    END IF;

    -- Pull secondary totals for proration
    SELECT secondary_quantity_received, quantity_received
      INTO v_secondary_total, v_total_received
    FROM public.grn_items
    WHERE grn_id = p_grn_id AND warehouse_item_id = v_alloc.warehouse_item_id
    LIMIT 1;

    v_secondary_delta := NULL;
    IF v_secondary_total IS NOT NULL AND COALESCE(v_total_received,0) > 0 THEN
      v_secondary_delta := v_secondary_total * v_alloc.quantity / v_total_received;
    END IF;

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

  -- Flip status (the existing update_stock_on_grn_approval trigger updates current_stock)
  UPDATE public.goods_receipt_notes
     SET status = 'approved',
         approved_by = v_user,
         approved_date = now()
   WHERE id = p_grn_id;

  RETURN jsonb_build_object(
    'grn_id', p_grn_id,
    'allocations', v_allocation_count
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.approve_grn_with_allocations(uuid, jsonb) TO authenticated;

-- =====================================================================
-- 3. Guard trigger: block approval flips that bypass the RPC
-- =====================================================================
CREATE OR REPLACE FUNCTION public.enforce_grn_allocation_on_approval()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'approved'
     AND (OLD.status IS NULL OR OLD.status <> 'approved')
     AND current_setting('app.grn_allocating', true) IS DISTINCT FROM '1' THEN
    RAISE EXCEPTION 'GRN approval must go through approve_grn_with_allocations() (ISO 9001 §8.6 GR-blocked stock)';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_grn_allocation_on_approval ON public.goods_receipt_notes;
CREATE TRIGGER trg_enforce_grn_allocation_on_approval
BEFORE UPDATE ON public.goods_receipt_notes
FOR EACH ROW EXECUTE FUNCTION public.enforce_grn_allocation_on_approval();
