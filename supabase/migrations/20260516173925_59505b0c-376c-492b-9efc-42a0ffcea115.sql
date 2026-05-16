
CREATE OR REPLACE FUNCTION public.bulk_import_inventory_with_stock(p_rows jsonb)
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
  v_status text;
  v_msg text;
  v_existing_id uuid;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  FOR v_row IN SELECT * FROM jsonb_array_elements(p_rows)
  LOOP
    v_idx := v_idx + 1;
    v_status := 'created';
    v_msg := NULL;
    v_catalog_id := NULL;
    v_item_id := NULL;

    BEGIN
      v_company_id := NULLIF(v_row->>'company_id','')::uuid;
      v_location_id := NULLIF(v_row->>'location_id','')::uuid;
      v_bin_id := NULLIF(v_row->>'bin_id','')::uuid;
      v_qty := COALESCE(NULLIF(v_row->>'opening_qty','')::numeric, 0);

      IF (v_row->>'name') IS NULL OR length(trim(v_row->>'name')) = 0 THEN
        RAISE EXCEPTION 'Name is required';
      END IF;

      IF v_company_id IS NULL THEN
        RAISE EXCEPTION 'Company is required';
      END IF;

      IF NOT can_access_company(v_company_id) THEN
        RAISE EXCEPTION 'No access to company';
      END IF;

      -- Try match existing catalog by item_code (preferred) or name
      IF NULLIF(v_row->>'item_code','') IS NOT NULL THEN
        SELECT id INTO v_existing_id FROM warehouse_item_catalog
        WHERE lower(item_code) = lower(v_row->>'item_code') LIMIT 1;
      END IF;

      IF v_existing_id IS NULL THEN
        SELECT id INTO v_existing_id FROM warehouse_item_catalog
        WHERE lower(name) = lower(v_row->>'name') LIMIT 1;
      END IF;

      IF v_existing_id IS NOT NULL THEN
        v_catalog_id := v_existing_id;
        v_status := 'matched';
      ELSE
        INSERT INTO warehouse_item_catalog (
          item_code, name, description, category_id, unit_id, location_id,
          brand, manufacturer, supplier_id, barcode, sku,
          unit_cost, selling_price, reorder_level, min_stock_level, max_stock_level,
          is_serialized, is_batch_tracked, status, notes, created_by
        ) VALUES (
          COALESCE(NULLIF(v_row->>'item_code',''), 'TEMP-' || gen_random_uuid()::text),
          v_row->>'name',
          NULLIF(v_row->>'description',''),
          NULLIF(v_row->>'category_id','')::uuid,
          NULLIF(v_row->>'unit_id','')::uuid,
          NULLIF(v_row->>'location_id','')::uuid,
          NULLIF(v_row->>'brand',''),
          NULLIF(v_row->>'manufacturer',''),
          NULLIF(v_row->>'supplier_id','')::uuid,
          NULLIF(v_row->>'barcode',''),
          NULLIF(v_row->>'sku',''),
          NULLIF(v_row->>'unit_cost','')::numeric,
          NULLIF(v_row->>'selling_price','')::numeric,
          NULLIF(v_row->>'reorder_level','')::numeric,
          NULLIF(v_row->>'min_stock_level','')::numeric,
          NULLIF(v_row->>'max_stock_level','')::numeric,
          COALESCE((v_row->>'is_serialized')::boolean, false),
          COALESCE((v_row->>'is_batch_tracked')::boolean, false),
          COALESCE(NULLIF(v_row->>'status',''), 'active'),
          NULLIF(v_row->>'notes',''),
          v_user
        ) RETURNING id INTO v_catalog_id;
      END IF;

      -- Ensure warehouse_items row exists for this company
      v_item_id := upsert_warehouse_inventory(
        p_company_id := v_company_id,
        p_catalog_item_id := v_catalog_id,
        p_location_id := v_location_id,
        p_unit_cost := NULLIF(v_row->>'unit_cost','')::numeric,
        p_selling_price := NULLIF(v_row->>'selling_price','')::numeric,
        p_reorder_level := NULLIF(v_row->>'reorder_level','')::numeric,
        p_min_stock_level := NULLIF(v_row->>'min_stock_level','')::numeric,
        p_max_stock_level := NULLIF(v_row->>'max_stock_level','')::numeric,
        p_status := COALESCE(NULLIF(v_row->>'status',''), 'active'),
        p_notes := NULLIF(v_row->>'notes','')
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
          NULLIF(v_row->>'unit_cost','')::numeric,
          v_qty * COALESCE(NULLIF(v_row->>'unit_cost','')::numeric, 0),
          COALESCE(NULLIF(v_row->>'stock_notes',''), 'Opening stock via Excel import'),
          v_company_id,
          v_user,
          v_location_id,
          v_bin_id,
          'opening_balance'
        );
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

GRANT EXECUTE ON FUNCTION public.bulk_import_inventory_with_stock(jsonb) TO authenticated;
