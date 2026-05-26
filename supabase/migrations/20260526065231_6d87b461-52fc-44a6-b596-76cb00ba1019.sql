
DO $$
DECLARE
  grp RECORD;
  itm RECORD;
  v_levels INT;
  v_racks INT;
  v_rack INT;
  v_level INT;
  v_idx INT;
  v_bin_code TEXT;
  v_bin_id UUID;
  v_bins_created INT := 0;
  v_allocs_created INT := 0;
  v_items_skipped INT := 0;
  v_bin_count INT;
BEGIN
  FOR grp IN
    SELECT wi.company_id, wi.location_id, COUNT(*) AS item_count
    FROM public.warehouse_items wi
    WHERE wi.current_stock > 0
      AND wi.location_id IS NOT NULL
      AND wi.company_id IS NOT NULL
      AND NOT EXISTS (
        SELECT 1 FROM public.warehouse_bin_allocations a WHERE a.warehouse_item_id = wi.id
      )
    GROUP BY wi.company_id, wi.location_id
  LOOP
    -- size grid: 5 levels per rack, enough racks to give every item its own bin
    v_levels := 5;
    v_racks  := GREATEST(1, CEIL(grp.item_count::numeric / v_levels)::int);

    -- create A01-R{rr}-L{ll} bins (idempotent)
    FOR v_rack IN 1..v_racks LOOP
      FOR v_level IN 1..v_levels LOOP
        v_bin_code := 'A01-R' || LPAD(v_rack::text, 2, '0') || '-L' || LPAD(v_level::text, 2, '0');
        INSERT INTO public.warehouse_bins (
          bin_code, name, location_id, root_location_id, company_id,
          status, is_global_template, is_shared, description
        )
        VALUES (
          v_bin_code, v_bin_code, grp.location_id, grp.location_id, grp.company_id,
          'active', false, false, 'Auto-generated GS1/SAP-EWM storage bin (backfill)'
        )
        ON CONFLICT DO NOTHING;
        GET DIAGNOSTICS v_bin_count = ROW_COUNT;
        v_bins_created := v_bins_created + v_bin_count;
      END LOOP;
    END LOOP;

    -- round-robin assign items to those bins
    v_idx := 0;
    FOR itm IN
      SELECT wi.id, wi.current_stock
      FROM public.warehouse_items wi
      WHERE wi.company_id = grp.company_id
        AND wi.location_id = grp.location_id
        AND wi.current_stock > 0
        AND NOT EXISTS (
          SELECT 1 FROM public.warehouse_bin_allocations a WHERE a.warehouse_item_id = wi.id
        )
      ORDER BY wi.id
    LOOP
      v_rack  := (v_idx / v_levels) + 1;
      v_level := (v_idx % v_levels) + 1;
      v_bin_code := 'A01-R' || LPAD(v_rack::text, 2, '0') || '-L' || LPAD(v_level::text, 2, '0');

      SELECT id INTO v_bin_id
      FROM public.warehouse_bins
      WHERE location_id = grp.location_id
        AND lower(bin_code) = lower(v_bin_code)
      LIMIT 1;

      IF v_bin_id IS NOT NULL THEN
        INSERT INTO public.warehouse_bin_allocations (
          warehouse_item_id, bin_id, location_id, company_id,
          allocated_quantity, reserved_quantity, notes
        )
        VALUES (
          itm.id, v_bin_id, grp.location_id, grp.company_id,
          itm.current_stock, 0, 'Auto-backfill A01-R##-L## scheme'
        )
        ON CONFLICT DO NOTHING;
        GET DIAGNOSTICS v_bin_count = ROW_COUNT;
        v_allocs_created := v_allocs_created + v_bin_count;
      END IF;
      v_idx := v_idx + 1;
    END LOOP;
  END LOOP;

  SELECT COUNT(*) INTO v_items_skipped
  FROM public.warehouse_items wi
  WHERE wi.current_stock > 0
    AND (wi.location_id IS NULL OR wi.company_id IS NULL);

  RAISE NOTICE 'Bin backfill complete. bins_created=%, allocations_created=%, items_skipped_no_location=%',
    v_bins_created, v_allocs_created, v_items_skipped;
END $$;
