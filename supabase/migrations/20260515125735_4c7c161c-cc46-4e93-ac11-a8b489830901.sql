
CREATE OR REPLACE FUNCTION public.import_partial_quantities(
  p_company_id uuid,
  p_rows jsonb,
  p_allow_create_bin boolean DEFAULT false
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_row jsonb;
  v_idx int := 0;
  v_inserted int := 0;
  v_updated int := 0;
  v_batches int := 0;
  v_bins_created int := 0;
  v_errors jsonb := '[]'::jsonb;
  v_item record;
  v_loc_id uuid;
  v_bin record;
  v_alloc record;
  v_batch_id uuid;
  v_qty numeric;
  v_sec numeric;
  v_mode text;
  v_delta numeric;
  v_new_qty numeric;
  v_new_sec numeric;
  v_unit_cost numeric;
  v_received_at timestamptz;
  v_ref text;
  v_notes text;
  v_batch_number text;
  v_mfg_date date;
  v_exp_date date;
  v_tx_type text;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'authentication_required' USING ERRCODE = '28000';
  END IF;

  IF NOT public.can_access_company(p_company_id) THEN
    RAISE EXCEPTION 'permission_denied' USING ERRCODE = '42501';
  END IF;

  IF jsonb_typeof(p_rows) <> 'array' THEN
    RAISE EXCEPTION 'rows_must_be_array' USING ERRCODE = '22023';
  END IF;

  FOR v_row IN SELECT * FROM jsonb_array_elements(p_rows)
  LOOP
    v_idx := v_idx + 1;
    BEGIN
      -- parse / validate inputs
      v_qty  := NULLIF(v_row->>'quantity', '')::numeric;
      v_sec  := NULLIF(v_row->>'secondary_quantity', '')::numeric;
      v_mode := COALESCE(NULLIF(lower(v_row->>'mode'), ''), 'add');
      v_unit_cost := NULLIF(v_row->>'unit_cost', '')::numeric;
      v_received_at := COALESCE(NULLIF(v_row->>'received_at','')::timestamptz, now());
      v_ref := NULLIF(trim(v_row->>'reference'), '');
      v_notes := NULLIF(trim(v_row->>'notes'), '');
      v_batch_number := NULLIF(trim(v_row->>'batch_number'), '');
      v_mfg_date := NULLIF(v_row->>'manufacture_date','')::date;
      v_exp_date := NULLIF(v_row->>'expiry_date','')::date;

      IF v_mode NOT IN ('add','set') THEN
        RAISE EXCEPTION 'invalid_mode';
      END IF;
      IF v_qty IS NULL OR v_qty < 0 OR (v_mode='add' AND v_qty=0) THEN
        RAISE EXCEPTION 'invalid_quantity';
      END IF;
      IF v_mfg_date IS NOT NULL AND v_exp_date IS NOT NULL AND v_mfg_date > v_exp_date THEN
        RAISE EXCEPTION 'mfg_after_expiry';
      END IF;

      -- resolve item (company-scoped)
      SELECT id, item_code, name,
             COALESCE(is_batch_tracked,false) AS is_batch_tracked,
             COALESCE(is_serialized,false) AS is_serialized,
             COALESCE(unit_cost,0) AS unit_cost
        INTO v_item
      FROM public.warehouse_items
      WHERE company_id = p_company_id
        AND lower(item_code) = lower(trim(v_row->>'item_code'))
      LIMIT 1;
      IF NOT FOUND THEN RAISE EXCEPTION 'item_not_found'; END IF;
      IF v_item.is_serialized THEN RAISE EXCEPTION 'serialized_item_not_supported'; END IF;
      IF v_item.is_batch_tracked AND v_batch_number IS NULL THEN
        RAISE EXCEPTION 'batch_number_required';
      END IF;

      -- resolve location
      SELECT id INTO v_loc_id
      FROM public.warehouse_locations
      WHERE company_id = p_company_id
        AND lower(code) = lower(trim(v_row->>'location_code'))
      LIMIT 1;
      IF v_loc_id IS NULL THEN
        SELECT id INTO v_loc_id
        FROM public.warehouse_locations
        WHERE company_id = p_company_id
          AND lower(name) = lower(trim(v_row->>'location_code'))
        LIMIT 1;
      END IF;
      IF v_loc_id IS NULL THEN RAISE EXCEPTION 'location_not_found'; END IF;

      -- resolve bin within location
      SELECT id, bin_code, location_id, company_id INTO v_bin
      FROM public.warehouse_bins
      WHERE location_id = v_loc_id
        AND lower(bin_code) = lower(trim(v_row->>'bin_code'))
      LIMIT 1;

      IF NOT FOUND THEN
        IF NOT p_allow_create_bin THEN RAISE EXCEPTION 'bin_not_found'; END IF;
        INSERT INTO public.warehouse_bins(bin_code, name, location_id, company_id, status, created_by)
        VALUES (trim(v_row->>'bin_code'), trim(v_row->>'bin_code'), v_loc_id, p_company_id, 'active', v_user)
        RETURNING id, bin_code, location_id, company_id INTO v_bin;
        v_bins_created := v_bins_created + 1;
      END IF;

      -- upsert batch if applicable
      IF v_item.is_batch_tracked THEN
        SELECT id INTO v_batch_id
        FROM public.item_batches
        WHERE warehouse_item_id = v_item.id AND batch_number = v_batch_number
        LIMIT 1;
        IF v_batch_id IS NULL THEN
          INSERT INTO public.item_batches(
            warehouse_item_id, batch_number, manufacturing_date, expiry_date,
            quantity_received, quantity_remaining, unit_cost, status, company_id, notes
          ) VALUES (
            v_item.id, v_batch_number, v_mfg_date, v_exp_date,
            v_qty, v_qty, COALESCE(v_unit_cost, v_item.unit_cost), 'active', p_company_id, v_notes
          ) RETURNING id INTO v_batch_id;
          v_batches := v_batches + 1;
        ELSIF v_mode = 'add' THEN
          UPDATE public.item_batches
             SET quantity_received = quantity_received + v_qty,
                 quantity_remaining = quantity_remaining + v_qty,
                 updated_at = now()
           WHERE id = v_batch_id;
        END IF;
      END IF;

      -- find existing allocation
      SELECT id, allocated_quantity, secondary_quantity
        INTO v_alloc
      FROM public.warehouse_bin_allocations
      WHERE company_id = p_company_id
        AND warehouse_item_id = v_item.id
        AND bin_id = v_bin.id
      FOR UPDATE;

      IF NOT FOUND THEN
        v_new_qty := v_qty;
        v_new_sec := v_sec;
        INSERT INTO public.warehouse_bin_allocations(
          warehouse_item_id, bin_id, allocated_quantity, reserved_quantity,
          secondary_quantity, company_id, created_by
        ) VALUES (
          v_item.id, v_bin.id, v_new_qty, 0, v_new_sec, p_company_id, v_user
        ) RETURNING id, allocated_quantity, secondary_quantity INTO v_alloc;
        v_delta := v_new_qty;
        v_inserted := v_inserted + 1;
      ELSE
        IF v_mode = 'add' THEN
          v_new_qty := COALESCE(v_alloc.allocated_quantity,0) + v_qty;
          v_new_sec := CASE WHEN v_sec IS NULL THEN v_alloc.secondary_quantity
                            ELSE COALESCE(v_alloc.secondary_quantity,0) + v_sec END;
        ELSE
          v_new_qty := v_qty;
          v_new_sec := v_sec;
        END IF;
        v_delta := v_new_qty - COALESCE(v_alloc.allocated_quantity,0);
        UPDATE public.warehouse_bin_allocations
           SET allocated_quantity = v_new_qty,
               secondary_quantity = v_new_sec,
               updated_at = now()
         WHERE id = v_alloc.id;
        v_updated := v_updated + 1;
      END IF;

      -- ledger entry (only if non-zero delta)
      IF v_delta <> 0 THEN
        v_tx_type := CASE WHEN v_delta > 0 THEN 'receipt' ELSE 'adjustment' END;
        INSERT INTO public.stock_transactions(
          item_id, transaction_type, reference_type, quantity_change,
          quantity_before, quantity_after,
          secondary_quantity_change, unit_cost,
          notes, company_id, created_by, batch_id,
          bin_id, location_id, adjustment_reason, created_at
        ) VALUES (
          v_item.id, v_tx_type::stock_transaction_type, 'import',
          v_delta,
          COALESCE(v_alloc.allocated_quantity,0),
          v_new_qty,
          CASE WHEN v_sec IS NULL THEN NULL
               WHEN v_mode='add' THEN v_sec
               ELSE v_new_sec - COALESCE(v_alloc.secondary_quantity,0) END,
          COALESCE(v_unit_cost, v_item.unit_cost),
          '[partial-import] mode:' || v_mode
            || COALESCE(' / batch:' || v_batch_number, '')
            || COALESCE(' / ref:' || v_ref, '')
            || COALESCE(' / ' || v_notes, ''),
          p_company_id, v_user, v_batch_id,
          v_bin.id, v_loc_id, 'import', v_received_at
        );
      END IF;

    EXCEPTION WHEN OTHERS THEN
      v_errors := v_errors || jsonb_build_object(
        'row', v_idx,
        'item_code', v_row->>'item_code',
        'bin_code', v_row->>'bin_code',
        'error', SQLERRM
      );
    END;
  END LOOP;

  IF jsonb_array_length(v_errors) > 0 THEN
    RAISE EXCEPTION 'partial_import_failed: %', v_errors::text USING ERRCODE = '22023';
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'inserted', v_inserted,
    'updated', v_updated,
    'batches_created', v_batches,
    'bins_created', v_bins_created
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.import_partial_quantities(uuid, jsonb, boolean) TO authenticated;
