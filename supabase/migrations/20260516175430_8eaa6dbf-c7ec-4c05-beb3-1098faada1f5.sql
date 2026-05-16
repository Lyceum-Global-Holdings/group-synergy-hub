
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
  v_qty numeric;
  v_unit_cost numeric;
  v_reorder numeric;
  v_status text;
  v_msg text;
  v_item_code text;
  v_gtin text;
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

      -- Validate location belongs to company (if locations are company-scoped)
      IF v_location_id IS NOT NULL THEN
        PERFORM 1 FROM warehouse_locations WHERE id = v_location_id;
        IF NOT FOUND THEN
          RAISE EXCEPTION 'Location not found';
        END IF;
      END IF;

      -- Validate bin belongs to location
      IF v_bin_id IS NOT NULL THEN
        IF v_location_id IS NULL THEN
          RAISE EXCEPTION 'Location is required when bin is provided';
        END IF;
        PERFORM 1 FROM warehouse_bins WHERE id = v_bin_id AND location_id = v_location_id;
        IF NOT FOUND THEN
          RAISE EXCEPTION 'Bin does not belong to the selected location';
        END IF;
      END IF;

      -- Provision (or find) warehouse_items row for (catalog, company, location)
      v_item_id := upsert_warehouse_inventory(
        p_company_id := v_company_id,
        p_catalog_item_id := v_catalog_id,
        p_location_id := v_location_id,
        p_unit_cost := v_unit_cost,
        p_reorder_level := v_reorder,
        p_status := 'active'
      );

      -- Post opening-stock transaction (trigger updates bin allocations + ledger balances)
      IF v_qty > 0 THEN
        IF v_location_id IS NULL THEN
          RAISE EXCEPTION 'Location is required when opening_qty > 0';
        END IF;

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
$$;

GRANT EXECUTE ON FUNCTION public.bulk_provision_inventory_from_catalog(jsonb) TO authenticated;
