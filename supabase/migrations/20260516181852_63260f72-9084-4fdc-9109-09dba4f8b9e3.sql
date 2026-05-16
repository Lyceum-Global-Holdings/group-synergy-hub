CREATE OR REPLACE FUNCTION public.bulk_provision_inventory_from_catalog(p_rows jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
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

      -- Resolve catalog item
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

      -- Validate location exists
      IF v_location_id IS NOT NULL THEN
        PERFORM 1 FROM warehouse_locations WHERE id = v_location_id;
        IF NOT FOUND THEN
          RAISE EXCEPTION 'Location not found';
        END IF;
      END IF;

      -- Validate bin's exact physical location matches selected location
      IF v_bin_id IS NOT NULL THEN
        IF v_location_id IS NULL THEN
          RAISE EXCEPTION 'Location is required when bin is provided';
        END IF;
        SELECT location_id INTO v_bin_location
        FROM warehouse_bins WHERE id = v_bin_id;
        IF v_bin_location IS NULL THEN
          RAISE EXCEPTION 'Bin not found or has no location';
        END IF;
        IF v_bin_location <> v_location_id THEN
          RAISE EXCEPTION 'Bin does not belong to the selected location/sub-location';
        END IF;
      END IF;

      -- Provision (or find) warehouse_items row for (company, catalog)
      v_item_id := upsert_warehouse_inventory(
        p_company_id := v_company_id,
        p_catalog_item_id := v_catalog_id,
        p_location_id := v_location_id,
        p_unit_cost := v_unit_cost,
        p_reorder_level := v_reorder,
        p_status := 'active'
      );

      -- Explicitly upsert the bin allocation for the exact (item, bin, company, location)
      -- and post the audit transaction. The bin allocation is the source of truth for
      -- physical placement; the stock_transactions row records the ledger entry.
      IF v_qty > 0 THEN
        IF v_location_id IS NULL THEN
          RAISE EXCEPTION 'Location is required when opening_qty > 0';
        END IF;
        IF v_bin_id IS NULL THEN
          RAISE EXCEPTION 'Bin is required when opening_qty > 0';
        END IF;

        -- Try to find an existing allocation for this exact tuple
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

        -- Audit/ledger transaction (qty_before/after are filled by trigger from live allocations)
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
$function$;

GRANT EXECUTE ON FUNCTION public.bulk_provision_inventory_from_catalog(jsonb) TO authenticated;