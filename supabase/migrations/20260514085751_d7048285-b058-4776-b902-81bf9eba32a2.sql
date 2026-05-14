-- 1. Schema additions
ALTER TABLE public.material_issue_items
  ADD COLUMN IF NOT EXISTS secondary_quantity_issued numeric,
  ADD COLUMN IF NOT EXISTS secondary_uom text;

ALTER TABLE public.material_return_items
  ADD COLUMN IF NOT EXISTS secondary_quantity_returned numeric,
  ADD COLUMN IF NOT EXISTS secondary_uom text;

-- 2. Material Issue RPC — adds p_secondary_quantity_issued, prorates across FIFO slices.
CREATE OR REPLACE FUNCTION public.process_material_issue_stock_update(
  p_item_id uuid,
  p_quantity_issued numeric,
  p_location_id uuid,
  p_bin_allocation_id uuid DEFAULT NULL,
  p_min_id uuid DEFAULT NULL,
  p_min_number text DEFAULT NULL,
  p_secondary_quantity_issued numeric DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_item RECORD;
  v_alloc RECORD;
  v_available numeric := 0;
  v_sec_available numeric := 0;
  v_remaining numeric := p_quantity_issued;
  v_sec_remaining numeric := COALESCE(p_secondary_quantity_issued, 0);
  v_take numeric;
  v_sec_take numeric;
  v_before numeric;
  v_company_id uuid;
  v_bin_id uuid;
  v_track_sec boolean := false;
  v_sec_uom text;
BEGIN
  IF p_location_id IS NULL THEN
    RAISE EXCEPTION 'Location is required for material issue (SAP MM Goods Issue must specify storage location)';
  END IF;

  IF p_quantity_issued IS NULL OR p_quantity_issued <= 0 THEN
    RAISE EXCEPTION 'Quantity issued must be positive';
  END IF;

  IF p_min_id IS NOT NULL THEN
    SELECT company_id INTO v_company_id FROM material_issue_notes WHERE id = p_min_id;
  END IF;

  SELECT * INTO v_item FROM warehouse_items WHERE id = p_item_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Warehouse item not found: %', p_item_id;
  END IF;

  v_track_sec := COALESCE(v_item.track_secondary_quantity, false);
  v_sec_uom := v_item.secondary_uom;

  -- If item is not dual-tracked, ignore any secondary param
  IF NOT v_track_sec THEN
    v_sec_remaining := 0;
  END IF;

  -- Aggregate available stock at the chosen location only
  SELECT
    COALESCE(SUM(GREATEST(0, wba.allocated_quantity - COALESCE(wba.reserved_quantity, 0))), 0),
    COALESCE(SUM(COALESCE(wba.secondary_quantity, 0)), 0)
    INTO v_available, v_sec_available
  FROM warehouse_bin_allocations wba
  JOIN warehouse_bins wb ON wb.id = wba.bin_id
  WHERE wba.warehouse_item_id = p_item_id
    AND wb.location_id = p_location_id;

  IF v_available < p_quantity_issued THEN
    RAISE EXCEPTION 'Insufficient stock at selected location. Available: %, Requested: %',
      v_available, p_quantity_issued;
  END IF;

  IF v_track_sec AND v_sec_remaining > 0 AND v_sec_available < v_sec_remaining THEN
    RAISE EXCEPTION 'Insufficient secondary stock at selected location. Available: %, Requested: %',
      v_sec_available, v_sec_remaining;
  END IF;

  IF p_bin_allocation_id IS NOT NULL THEN
    PERFORM 1
    FROM warehouse_bin_allocations wba
    JOIN warehouse_bins wb ON wb.id = wba.bin_id
    WHERE wba.id = p_bin_allocation_id
      AND wba.warehouse_item_id = p_item_id
      AND wb.location_id = p_location_id;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Selected bin does not belong to the issue location';
    END IF;
  END IF;

  -- FIFO consumption across bins at the location
  FOR v_alloc IN
    SELECT wba.id, wba.bin_id, wba.allocated_quantity,
           COALESCE(wba.reserved_quantity, 0) AS reserved_quantity,
           COALESCE(wba.secondary_quantity, 0) AS secondary_quantity
    FROM warehouse_bin_allocations wba
    JOIN warehouse_bins wb ON wb.id = wba.bin_id
    WHERE wba.warehouse_item_id = p_item_id
      AND wb.location_id = p_location_id
      AND (p_bin_allocation_id IS NULL OR wba.id = p_bin_allocation_id)
      AND wba.allocated_quantity > 0
    ORDER BY
      CASE WHEN p_bin_allocation_id IS NOT NULL AND wba.id = p_bin_allocation_id THEN 0 ELSE 1 END,
      wba.created_at ASC
    FOR UPDATE
  LOOP
    EXIT WHEN v_remaining <= 0;

    v_take := LEAST(v_alloc.allocated_quantity, v_remaining);
    IF v_take <= 0 THEN
      CONTINUE;
    END IF;

    v_before := v_alloc.allocated_quantity;
    v_bin_id := v_alloc.bin_id;

    -- Prorate secondary by base proportion; last slice absorbs remainder.
    IF v_track_sec AND v_sec_remaining > 0 THEN
      IF v_take >= v_remaining THEN
        v_sec_take := LEAST(v_sec_remaining, v_alloc.secondary_quantity);
      ELSE
        v_sec_take := ROUND(COALESCE(p_secondary_quantity_issued,0) * (v_take / p_quantity_issued), 4);
        v_sec_take := LEAST(v_sec_take, v_alloc.secondary_quantity, v_sec_remaining);
      END IF;
    ELSE
      v_sec_take := 0;
    END IF;

    -- Legacy per-bin movement log
    INSERT INTO warehouse_stock_movements (
      warehouse_item_id, bin_allocation_id, movement_type,
      reference_type, reference_id, reference_number,
      quantity_change, quantity_before, quantity_after,
      notes, created_by, created_at
    ) VALUES (
      p_item_id, v_alloc.id, 'issue',
      'material_issue', p_min_id, p_min_number,
      -v_take, v_before, v_before - v_take,
      'Material issued via MIN: ' || COALESCE(p_min_number, 'Unknown'),
      auth.uid(), NOW()
    );

    -- Canonical stock_transactions row. Trigger fills (secondary_)quantity_before/after.
    INSERT INTO stock_transactions (
      item_id, location_id, bin_id,
      transaction_type, reference_type, reference_id,
      quantity_change,
      secondary_quantity_change, secondary_uom,
      notes, company_id, created_by
    ) VALUES (
      p_item_id, p_location_id, v_bin_id,
      'material_issue', 'manual', p_min_id,
      -v_take,
      CASE WHEN v_track_sec AND v_sec_take > 0 THEN -v_sec_take ELSE NULL END,
      CASE WHEN v_track_sec THEN v_sec_uom ELSE NULL END,
      'Material Issue: ' || COALESCE(p_min_number, p_min_id::text, 'MIN'),
      v_company_id, auth.uid()
    );

    UPDATE warehouse_bin_allocations
    SET
      allocated_quantity = GREATEST(0, allocated_quantity - v_take),
      reserved_quantity  = GREATEST(0, COALESCE(reserved_quantity, 0) - LEAST(v_take, COALESCE(reserved_quantity, 0))),
      secondary_quantity = CASE
        WHEN v_track_sec THEN GREATEST(0, COALESCE(secondary_quantity, 0) - v_sec_take)
        ELSE secondary_quantity
      END,
      updated_at = NOW()
    WHERE id = v_alloc.id;

    v_remaining := v_remaining - v_take;
    v_sec_remaining := v_sec_remaining - v_sec_take;
  END LOOP;

  IF v_remaining > 0 THEN
    RAISE EXCEPTION 'Could not allocate full quantity at location. Short by %', v_remaining;
  END IF;

  UPDATE warehouse_items
  SET reserved_quantity = GREATEST(0, COALESCE(reserved_quantity, 0) - p_quantity_issued),
      updated_at = NOW()
  WHERE id = p_item_id;
END;
$function$;

-- 3. Material Return RPC — adds p_secondary_quantity_returned.
CREATE OR REPLACE FUNCTION public.process_material_return_stock_update(
  p_item_id uuid,
  p_quantity_returned numeric,
  p_bin_allocation_id uuid DEFAULT NULL,
  p_mrn_id uuid DEFAULT NULL,
  p_mrn_number text DEFAULT NULL,
  p_company_id uuid DEFAULT NULL,
  p_secondary_quantity_returned numeric DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_warehouse_item RECORD;
  v_bin_alloc_id uuid;
  v_bin_id uuid;
  v_location_id uuid;
  v_track_sec boolean := false;
  v_sec_uom text;
  v_sec_qty numeric;
BEGIN
  SELECT * INTO v_warehouse_item
  FROM warehouse_items WHERE id = p_item_id FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Warehouse item not found: %', p_item_id;
  END IF;

  v_track_sec := COALESCE(v_warehouse_item.track_secondary_quantity, false);
  v_sec_uom := v_warehouse_item.secondary_uom;
  v_sec_qty := CASE WHEN v_track_sec THEN COALESCE(p_secondary_quantity_returned, 0) ELSE 0 END;

  v_bin_alloc_id := p_bin_allocation_id;

  IF v_bin_alloc_id IS NULL AND p_company_id IS NOT NULL THEN
    SELECT id INTO v_bin_alloc_id
    FROM warehouse_bin_allocations
    WHERE warehouse_item_id = p_item_id AND company_id = p_company_id
    LIMIT 1;
  END IF;

  IF v_bin_alloc_id IS NOT NULL THEN
    SELECT wba.bin_id, wb.location_id
      INTO v_bin_id, v_location_id
    FROM warehouse_bin_allocations wba
    JOIN warehouse_bins wb ON wb.id = wba.bin_id
    WHERE wba.id = v_bin_alloc_id;
  END IF;

  -- Insert canonical stock_transactions row first (trigger reads pre-state from bin/location)
  INSERT INTO stock_transactions (
    item_id, location_id, bin_id,
    transaction_type, reference_type, reference_id,
    quantity_change,
    secondary_quantity_change, secondary_uom,
    notes, company_id, created_by
  ) VALUES (
    p_item_id, v_location_id, v_bin_id,
    'material_return', 'mrn', p_mrn_id,
    p_quantity_returned,
    CASE WHEN v_track_sec AND v_sec_qty > 0 THEN v_sec_qty ELSE NULL END,
    CASE WHEN v_track_sec THEN v_sec_uom ELSE NULL END,
    'Material Return via MRN: ' || COALESCE(p_mrn_number, 'Unknown'),
    p_company_id, auth.uid()
  );

  -- Update warehouse item base stock
  UPDATE warehouse_items
  SET current_stock = current_stock + p_quantity_returned, updated_at = NOW()
  WHERE id = p_item_id;

  -- Update bin allocation (base + secondary) when known
  IF v_bin_alloc_id IS NOT NULL THEN
    UPDATE warehouse_bin_allocations
    SET allocated_quantity = allocated_quantity + p_quantity_returned,
        secondary_quantity = CASE
          WHEN v_track_sec THEN COALESCE(secondary_quantity, 0) + v_sec_qty
          ELSE secondary_quantity
        END,
        updated_at = NOW()
    WHERE id = v_bin_alloc_id;
  END IF;
END;
$$;