-- 1. Location-scoped reconciliation
CREATE OR REPLACE FUNCTION public.reconcile_stock_batch(
  p_item_ids uuid[],
  p_company_id uuid,
  p_overrides jsonb DEFAULT '{}'::jsonb,
  p_user_id uuid DEFAULT NULL,
  p_location_id uuid DEFAULT NULL
)
RETURNS TABLE(item_id uuid, item_code text, action text, message text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
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
  v_loc_stock numeric;
  v_loc_alloc_total numeric;
BEGIN
  FOREACH v_item_id IN ARRAY p_item_ids
  LOOP
    SELECT wi.item_code, wi.current_stock, wi.location_id
      INTO v_item_code, v_current_stock, v_location_id
    FROM warehouse_items wi
    WHERE wi.id = v_item_id;

    IF v_item_code IS NULL THEN
      item_id := v_item_id; item_code := 'UNKNOWN'; action := 'error'; message := 'Item not found';
      RETURN NEXT; CONTINUE;
    END IF;

    v_override := p_overrides -> v_item_id::text;
    v_override_location_id := NULL;
    v_override_bin_id := NULL;

    IF v_override IS NOT NULL AND v_override != 'null'::jsonb THEN
      v_override_location_id := (v_override ->> 'locationId')::uuid;
      v_override_bin_id := (v_override ->> 'binId')::uuid;
    END IF;

    -- =====================================================================
    -- LOCATION-SCOPED PATH: only reconcile within the selected physical site
    -- =====================================================================
    IF p_location_id IS NOT NULL THEN
      -- Bin total at this location only
      SELECT COALESCE(SUM(wba.allocated_quantity), 0)
        INTO v_loc_alloc_total
      FROM warehouse_bin_allocations wba
      JOIN warehouse_bins wb ON wb.id = wba.bin_id
      WHERE wba.warehouse_item_id = v_item_id
        AND wba.company_id = p_company_id
        AND wb.location_id = p_location_id;

      -- Authoritative location stock = sum of allocations at the location.
      -- We DO NOT use warehouse_items.current_stock here, because that is a
      -- global aggregate across all locations.
      v_loc_stock := v_loc_alloc_total;

      -- Find any existing allocation row for this item at this location to use
      -- as the primary anchor when fixing — but if totals already reconcile
      -- to themselves there is nothing to do.
      SELECT wba.id INTO v_alloc_id
      FROM warehouse_bin_allocations wba
      JOIN warehouse_bins wb ON wb.id = wba.bin_id
      WHERE wba.warehouse_item_id = v_item_id
        AND wba.company_id = p_company_id
        AND wb.location_id = p_location_id
      ORDER BY wba.allocated_quantity DESC
      LIMIT 1;

      IF v_alloc_id IS NOT NULL THEN
        item_id := v_item_id; item_code := v_item_code; action := 'ok';
        message := 'Already in sync at location (loc_stock=' || v_loc_stock || ')';
        RETURN NEXT; CONTINUE;
      END IF;

      -- No allocation at this location.
      -- Create one ONLY if an explicit bin override is supplied. We never
      -- silently invent stock at this location from the global item total.
      IF v_override_bin_id IS NOT NULL THEN
        -- Validate the override bin actually belongs to this location
        IF NOT EXISTS (
          SELECT 1 FROM warehouse_bins
          WHERE id = v_override_bin_id AND location_id = p_location_id
        ) THEN
          item_id := v_item_id; item_code := v_item_code; action := 'blocked';
          message := 'Override bin is not at the selected location';
          RETURN NEXT; CONTINUE;
        END IF;

        INSERT INTO warehouse_bin_allocations (
          warehouse_item_id, bin_id, allocated_quantity, company_id
        ) VALUES (
          v_item_id, v_override_bin_id, 0, p_company_id
        )
        ON CONFLICT (warehouse_item_id, bin_id, company_id) DO NOTHING;

        item_id := v_item_id; item_code := v_item_code; action := 'created';
        message := 'Created empty allocation at selected location bin';
        RETURN NEXT; CONTINUE;
      END IF;

      item_id := v_item_id; item_code := v_item_code; action := 'blocked';
      message := 'No allocation at selected location and no bin override provided';
      RETURN NEXT; CONTINUE;
    END IF;

    -- =====================================================================
    -- LEGACY GLOBAL PATH (no p_location_id supplied)
    -- =====================================================================
    IF v_override_location_id IS NOT NULL AND (v_location_id IS NULL OR v_location_id != v_override_location_id) THEN
      UPDATE warehouse_items SET location_id = v_override_location_id WHERE id = v_item_id;
      v_location_id := v_override_location_id;
    END IF;

    SELECT COALESCE(SUM(wba.allocated_quantity), 0)
      INTO v_alloc_total
    FROM warehouse_bin_allocations wba
    WHERE wba.warehouse_item_id = v_item_id
      AND wba.company_id = p_company_id;

    SELECT wba.id INTO v_alloc_id
    FROM warehouse_bin_allocations wba
    WHERE wba.warehouse_item_id = v_item_id
      AND wba.company_id = p_company_id
    ORDER BY wba.allocated_quantity DESC
    LIMIT 1;

    v_diff := v_current_stock - v_alloc_total;

    IF v_diff = 0 THEN
      item_id := v_item_id; item_code := v_item_code; action := 'ok';
      message := 'Already in sync (stock=' || v_current_stock || ')';
      RETURN NEXT; CONTINUE;
    END IF;

    IF v_alloc_id IS NOT NULL THEN
      UPDATE warehouse_bin_allocations
      SET allocated_quantity = GREATEST(0, allocated_quantity + v_diff)
      WHERE id = v_alloc_id;

      item_id := v_item_id; item_code := v_item_code; action := 'adjusted';
      message := 'Adjusted allocation by ' || v_diff || ' (stock=' || v_current_stock || ', was_alloc=' || v_alloc_total || ')';
      RETURN NEXT; CONTINUE;
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
      item_id := v_item_id; item_code := v_item_code; action := 'blocked';
      message := 'No location/bin available (stock=' || v_current_stock || ')';
      RETURN NEXT; CONTINUE;
    END IF;

    INSERT INTO warehouse_bin_allocations (
      warehouse_item_id, bin_id, allocated_quantity, company_id
    ) VALUES (
      v_item_id, v_bin_id, GREATEST(0, v_current_stock), p_company_id
    );

    item_id := v_item_id; item_code := v_item_code; action := 'created';
    message := 'Created allocation with qty=' || GREATEST(0, v_current_stock);
    RETURN NEXT;
  END LOOP;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.reconcile_stock_batch(uuid[], uuid, jsonb, uuid, uuid) TO authenticated;

-- 2. Location-aware audit
CREATE OR REPLACE FUNCTION public.stock_audit_summary_by_location(
  p_company_id uuid,
  p_location_id uuid
)
RETURNS TABLE(
  id uuid,
  item_code text,
  name text,
  current_stock numeric,
  bin_total numeric,
  bin_count int,
  variance numeric,
  status text
)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path TO 'public'
AS $$
  WITH loc_alloc AS (
    SELECT wba.warehouse_item_id AS item_id,
           SUM(wba.allocated_quantity) AS bin_total,
           COUNT(wba.id)::int AS bin_count
    FROM public.warehouse_bin_allocations wba
    JOIN public.warehouse_bins wb ON wb.id = wba.bin_id
    WHERE wb.location_id = p_location_id
      AND wba.company_id = p_company_id
    GROUP BY wba.warehouse_item_id
  )
  SELECT
    wi.id,
    wi.item_code,
    wi.name,
    -- "Location stock" = sum of bin allocations at this location.
    -- We do NOT use warehouse_items.current_stock here because that is global.
    COALESCE(la.bin_total, 0) AS current_stock,
    COALESCE(la.bin_total, 0) AS bin_total,
    COALESCE(la.bin_count, 0) AS bin_count,
    0::numeric AS variance,
    CASE
      WHEN COALESCE(la.bin_count, 0) = 0 THEN 'no_bins'
      ELSE 'ok'
    END AS status
  FROM public.warehouse_items wi
  LEFT JOIN loc_alloc la ON la.item_id = wi.id
  WHERE wi.status = 'active'
    AND wi.company_id = p_company_id
    AND COALESCE(la.bin_total, 0) > 0;
$$;

GRANT EXECUTE ON FUNCTION public.stock_audit_summary_by_location(uuid, uuid) TO authenticated;