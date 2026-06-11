
-- =====================================================================
-- 1. Fix bulk_provision_inventory_from_catalog: post ledger BEFORE allocation
-- =====================================================================
CREATE OR REPLACE FUNCTION public.bulk_provision_inventory_from_catalog(p_rows jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_results jsonb := '[]'::jsonb;
  v_row jsonb;
  v_idx int := 0;
  v_catalog_id uuid;
  v_item_id uuid;
  v_company_id uuid;
  v_location_id uuid;
  v_bin_id uuid;
  v_bin_location uuid;
  v_qty numeric;
  v_unit_cost numeric;
  v_reorder numeric;
  v_status text;
  v_msg text;
  v_item_code text;
  v_gtin text;
  v_alloc_id uuid;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF p_rows IS NULL OR jsonb_typeof(p_rows) <> 'array' THEN
    RAISE EXCEPTION 'p_rows must be a JSON array';
  END IF;

  FOR v_row IN SELECT * FROM jsonb_array_elements(p_rows)
  LOOP
    v_idx := v_idx + 1;
    v_status := 'imported';
    v_msg := NULL;
    v_catalog_id := NULL;
    v_item_id := NULL;

    BEGIN
      v_company_id := NULLIF(v_row->>'company_id','')::uuid;
      v_location_id := NULLIF(v_row->>'location_id','')::uuid;
      v_bin_id := NULLIF(v_row->>'bin_id','')::uuid;
      v_qty := COALESCE(NULLIF(v_row->>'opening_qty','')::numeric, 0);
      v_unit_cost := NULLIF(v_row->>'unit_cost','')::numeric;
      v_reorder := NULLIF(v_row->>'reorder_level','')::numeric;
      v_item_code := NULLIF(v_row->>'item_code','');
      v_gtin := NULLIF(v_row->>'gtin','');
      v_catalog_id := NULLIF(v_row->>'catalog_item_id','')::uuid;

      IF v_catalog_id IS NULL AND v_item_code IS NOT NULL THEN
        SELECT id INTO v_catalog_id FROM warehouse_item_catalog
        WHERE lower(item_code) = lower(v_item_code) LIMIT 1;
      END IF;

      IF v_catalog_id IS NULL AND v_gtin IS NOT NULL THEN
        SELECT id INTO v_catalog_id FROM warehouse_item_catalog
        WHERE barcode = v_gtin OR sku = v_gtin LIMIT 1;
      END IF;

      IF v_catalog_id IS NULL THEN
        RAISE EXCEPTION 'Catalog item not found (provide catalog_item_id, item_code, or gtin)';
      END IF;

      IF v_company_id IS NULL THEN
        RAISE EXCEPTION 'Company is required';
      END IF;

      IF NOT can_access_company(v_company_id) THEN
        RAISE EXCEPTION 'No access to company';
      END IF;

      IF v_location_id IS NOT NULL THEN
        PERFORM 1 FROM warehouse_locations WHERE id = v_location_id;
        IF NOT FOUND THEN
          RAISE EXCEPTION 'Location not found';
        END IF;
      END IF;

      IF v_bin_id IS NOT NULL THEN
        IF v_location_id IS NULL THEN
          RAISE EXCEPTION 'Location is required when bin is provided';
        END IF;
        SELECT location_id INTO v_bin_location FROM warehouse_bins WHERE id = v_bin_id;
        IF v_bin_location IS NULL THEN
          RAISE EXCEPTION 'Bin not found or has no location';
        END IF;
        IF v_bin_location <> v_location_id THEN
          RAISE EXCEPTION 'Bin does not belong to the selected location/sub-location';
        END IF;
      END IF;

      v_item_id := upsert_warehouse_inventory(
        p_company_id := v_company_id,
        p_catalog_item_id := v_catalog_id,
        p_location_id := v_location_id,
        p_unit_cost := v_unit_cost,
        p_reorder_level := v_reorder,
        p_status := 'active'
      );

      IF v_qty > 0 THEN
        IF v_location_id IS NULL THEN
          RAISE EXCEPTION 'Location is required when opening_qty > 0';
        END IF;
        IF v_bin_id IS NULL THEN
          RAISE EXCEPTION 'Bin is required when opening_qty > 0';
        END IF;

        -- STEP 1: Ledger row FIRST. BEFORE-INSERT trigger reads current bin
        -- allocation (still 0 for a fresh row) and sets qty_before/qty_after.
        INSERT INTO stock_transactions (
          item_id, transaction_type, reference_type, quantity_change,
          unit_cost, total_value, notes, company_id, created_by,
          location_id, bin_id, adjustment_reason
        ) VALUES (
          v_item_id,
          'opening_stock',
          'manual',
          v_qty,
          v_unit_cost,
          v_qty * COALESCE(v_unit_cost, 0),
          COALESCE(NULLIF(v_row->>'notes',''), 'Opening stock via bulk catalog import'),
          v_company_id,
          v_user,
          v_location_id,
          v_bin_id,
          'opening_balance'
        );

        -- STEP 2: Now upsert the bin allocation to match the ledger.
        SELECT id INTO v_alloc_id
        FROM warehouse_bin_allocations
        WHERE warehouse_item_id = v_item_id
          AND bin_id = v_bin_id
          AND company_id = v_company_id
          AND location_id = v_location_id
        LIMIT 1;

        IF v_alloc_id IS NOT NULL THEN
          UPDATE warehouse_bin_allocations
          SET allocated_quantity = allocated_quantity + v_qty,
              updated_at = now()
          WHERE id = v_alloc_id;
        ELSE
          INSERT INTO warehouse_bin_allocations (
            warehouse_item_id, bin_id, allocated_quantity, reserved_quantity,
            company_id, location_id, created_by
          ) VALUES (
            v_item_id, v_bin_id, v_qty, 0,
            v_company_id, v_location_id, v_user
          );
        END IF;
      ELSE
        v_status := 'provisioned';
      END IF;

      v_results := v_results || jsonb_build_object(
        'row', v_idx,
        'status', v_status,
        'catalog_item_id', v_catalog_id,
        'warehouse_item_id', v_item_id
      );

    EXCEPTION WHEN OTHERS THEN
      v_msg := SQLERRM;
      v_results := v_results || jsonb_build_object(
        'row', v_idx,
        'status', 'error',
        'error', v_msg
      );
    END;
  END LOOP;

  RETURN v_results;
END;
$$;

-- =====================================================================
-- 2. Fix approve_grn_with_allocations: ledger FIRST, then allocation upsert,
--    per-allocation in a single loop so each ledger row sees the prior state.
-- =====================================================================
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

    SELECT secondary_quantity_received, quantity_received, unit_price, item_name, secondary_uom
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

-- =====================================================================
-- 3. One-time backfill: recompute Qty Before/After as running totals
--    grouped by (company, item, location, bin), ordered by (created_at, id).
-- =====================================================================
CREATE OR REPLACE FUNCTION public.recompute_stock_ledger_balances()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_updated int := 0;
BEGIN
  IF auth.uid() IS NOT NULL AND NOT public.is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Admin role required';
  END IF;

  WITH ordered AS (
    SELECT
      id,
      quantity_before AS old_before,
      quantity_after  AS old_after,
      secondary_quantity_before AS old_sec_before,
      secondary_quantity_after  AS old_sec_after,
      COALESCE(SUM(quantity_change) OVER w, 0)
        - COALESCE(quantity_change, 0) AS new_before,
      COALESCE(SUM(quantity_change) OVER w, 0) AS new_after,
      COALESCE(SUM(secondary_quantity_change) OVER w, 0)
        - COALESCE(secondary_quantity_change, 0) AS new_sec_before,
      COALESCE(SUM(secondary_quantity_change) OVER w, 0) AS new_sec_after
    FROM public.stock_transactions
    WINDOW w AS (
      PARTITION BY company_id, item_id, location_id, bin_id
      ORDER BY created_at, id
      ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW
    )
  )
  UPDATE public.stock_transactions st
     SET quantity_before = o.new_before,
         quantity_after  = o.new_after,
         secondary_quantity_before = o.new_sec_before,
         secondary_quantity_after  = o.new_sec_after
    FROM ordered o
   WHERE st.id = o.id
     AND ( st.quantity_before IS DISTINCT FROM o.new_before
        OR st.quantity_after  IS DISTINCT FROM o.new_after
        OR st.secondary_quantity_before IS DISTINCT FROM o.new_sec_before
        OR st.secondary_quantity_after  IS DISTINCT FROM o.new_sec_after );

  GET DIAGNOSTICS v_updated = ROW_COUNT;
  RETURN jsonb_build_object('updated', v_updated);
END;
$$;

REVOKE ALL ON FUNCTION public.recompute_stock_ledger_balances() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.recompute_stock_ledger_balances() TO authenticated, service_role;

-- Run once now to fix historical rows.
SELECT public.recompute_stock_ledger_balances();
