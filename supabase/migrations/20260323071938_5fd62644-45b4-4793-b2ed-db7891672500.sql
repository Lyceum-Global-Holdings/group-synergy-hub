CREATE OR REPLACE FUNCTION public.reconcile_stock_batch(
  p_item_ids uuid[],
  p_company_id uuid,
  p_overrides jsonb DEFAULT '{}'::jsonb,
  p_user_id uuid DEFAULT NULL
)
RETURNS TABLE(item_id uuid, item_code text, action text, message text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_item_id uuid;
  v_item_code text;
  v_current_stock numeric;
  v_location_id uuid;
  v_alloc_total numeric;
  v_alloc_id uuid;
  v_diff numeric;
  v_override_location_id uuid;
  v_override_bin_id uuid;
  v_bin_id uuid;
  v_override jsonb;
BEGIN
  FOREACH v_item_id IN ARRAY p_item_ids
  LOOP
    SELECT wi.item_code, wi.current_stock, wi.location_id
    INTO v_item_code, v_current_stock, v_location_id
    FROM warehouse_items wi
    WHERE wi.id = v_item_id;

    IF v_item_code IS NULL THEN
      item_id := v_item_id;
      item_code := 'UNKNOWN';
      action := 'error';
      message := 'Item not found';
      RETURN NEXT;
      CONTINUE;
    END IF;

    v_override := p_overrides -> v_item_id::text;
    v_override_location_id := NULL;
    v_override_bin_id := NULL;
    
    IF v_override IS NOT NULL AND v_override != 'null'::jsonb THEN
      v_override_location_id := (v_override ->> 'locationId')::uuid;
      v_override_bin_id := (v_override ->> 'binId')::uuid;
      
      IF v_override_location_id IS NOT NULL AND (v_location_id IS NULL OR v_location_id != v_override_location_id) THEN
        UPDATE warehouse_items SET location_id = v_override_location_id WHERE id = v_item_id;
        v_location_id := v_override_location_id;
      END IF;
    END IF;

    SELECT COALESCE(SUM(wba.allocated_quantity), 0), MIN(wba.id)
    INTO v_alloc_total, v_alloc_id
    FROM warehouse_bin_allocations wba
    WHERE wba.warehouse_item_id = v_item_id
      AND wba.company_id = p_company_id;

    v_diff := v_current_stock - v_alloc_total;

    IF v_diff = 0 THEN
      item_id := v_item_id;
      item_code := v_item_code;
      action := 'ok';
      message := 'Already in sync (stock=' || v_current_stock || ')';
      RETURN NEXT;
      CONTINUE;
    END IF;

    IF v_alloc_id IS NOT NULL THEN
      UPDATE warehouse_bin_allocations
      SET allocated_quantity = GREATEST(0, allocated_quantity + v_diff)
      WHERE id = v_alloc_id;

      item_id := v_item_id;
      item_code := v_item_code;
      action := 'adjusted';
      message := 'Adjusted allocation by ' || v_diff || ' (stock=' || v_current_stock || ', was_alloc=' || v_alloc_total || ')';
      RETURN NEXT;
      CONTINUE;
    END IF;

    v_bin_id := v_override_bin_id;
    
    IF v_bin_id IS NULL AND v_location_id IS NOT NULL THEN
      SELECT wb.id INTO v_bin_id
      FROM warehouse_bins wb
      WHERE wb.location_id = v_location_id
        AND wb.status = 'active'
      ORDER BY wb.bin_code ASC
      LIMIT 1;
    END IF;

    IF v_bin_id IS NULL THEN
      item_id := v_item_id;
      item_code := v_item_code;
      action := 'blocked';
      message := 'No location/bin available (stock=' || v_current_stock || ')';
      RETURN NEXT;
      CONTINUE;
    END IF;

    INSERT INTO warehouse_bin_allocations (
      warehouse_item_id, bin_id, allocated_quantity, company_id
    ) VALUES (
      v_item_id, v_bin_id, GREATEST(0, v_current_stock), p_company_id
    );

    item_id := v_item_id;
    item_code := v_item_code;
    action := 'created';
    message := 'Created allocation with qty=' || GREATEST(0, v_current_stock);
    RETURN NEXT;
  END LOOP;
END;
$$;