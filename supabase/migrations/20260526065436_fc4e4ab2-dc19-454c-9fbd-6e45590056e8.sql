
DO $$
DECLARE
  itm RECORD;
  v_aisle INT;
  v_rack INT;
  v_level INT;
  v_levels INT := 5;
  v_bin_code TEXT;
  v_bin_id UUID;
  v_count INT;
  v_done INT := 0;
  v_idx INT := 0;
BEGIN
  FOR itm IN
    SELECT wi.id, wi.current_stock, wi.company_id, wi.location_id
    FROM public.warehouse_items wi
    WHERE wi.current_stock > 0
      AND wi.location_id IS NOT NULL
      AND wi.company_id IS NOT NULL
      AND NOT EXISTS (SELECT 1 FROM public.warehouse_bin_allocations a WHERE a.warehouse_item_id = wi.id)
    ORDER BY wi.location_id, wi.id
  LOOP
    v_bin_id := NULL;
    v_rack  := (v_idx / v_levels) + 1;
    v_level := (v_idx % v_levels) + 1;

    -- try aisles 1..99 until insertion succeeds or we find an existing bin AT the same location
    FOR v_aisle IN 1..99 LOOP
      v_bin_code := 'A' || LPAD(v_aisle::text,2,'0') || '-R' || LPAD(v_rack::text,2,'0') || '-L' || LPAD(v_level::text,2,'0');

      -- prefer existing bin AT the same location
      SELECT id INTO v_bin_id
      FROM public.warehouse_bins
      WHERE company_id = itm.company_id
        AND location_id = itm.location_id
        AND lower(bin_code) = lower(v_bin_code)
      LIMIT 1;

      IF v_bin_id IS NOT NULL THEN
        EXIT;
      END IF;

      BEGIN
        INSERT INTO public.warehouse_bins
          (bin_code, name, location_id, root_location_id, company_id, status, is_global_template, is_shared, description)
        VALUES
          (v_bin_code, v_bin_code, itm.location_id, itm.location_id, itm.company_id, 'active', false, false, 'Auto-generated GS1/SAP-EWM storage bin (backfill)')
        RETURNING id INTO v_bin_id;
        EXIT;
      EXCEPTION WHEN unique_violation THEN
        v_bin_id := NULL;
      END;
    END LOOP;

    IF v_bin_id IS NOT NULL THEN
      INSERT INTO public.warehouse_bin_allocations
        (warehouse_item_id, bin_id, location_id, company_id, allocated_quantity, reserved_quantity, notes)
      VALUES
        (itm.id, v_bin_id, itm.location_id, itm.company_id, itm.current_stock, 0, 'Auto-backfill A##-R##-L## scheme')
      ON CONFLICT DO NOTHING;
      GET DIAGNOSTICS v_count = ROW_COUNT;
      v_done := v_done + v_count;
    END IF;
    v_idx := v_idx + 1;
  END LOOP;

  RAISE NOTICE 'Backfill round 3: allocations_created=%', v_done;
END $$;
