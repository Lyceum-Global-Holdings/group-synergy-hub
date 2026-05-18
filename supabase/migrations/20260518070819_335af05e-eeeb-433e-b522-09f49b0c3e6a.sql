-- Phase 2b (stock-flow only): post Tool Management movements to the unified
-- inventory ledger. Adds three SECURITY DEFINER RPCs that mutate
-- warehouse_bin_allocations + warehouse_items.current_stock and write
-- stock_transactions rows. Legacy warehouse_tools rows continue to be
-- maintained by the existing hook code; these RPCs make the loan/return/
-- adjustment events visible in the standard ledger and inventory views.

-- Helper: pick the bin allocation row with the most available (or most reserved)
-- for a given warehouse_item_id. Returns NULL if none.

CREATE OR REPLACE FUNCTION public.tool_issue_post_ledger(
  p_warehouse_item_id uuid,
  p_quantity numeric,
  p_reference_id uuid,
  p_company_id uuid,
  p_notes text DEFAULT NULL
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_alloc record;
  v_item record;
  v_user uuid := auth.uid();
  v_qty_before numeric;
BEGIN
  IF p_quantity IS NULL OR p_quantity <= 0 THEN RETURN; END IF;

  SELECT id, current_stock, location_id, company_id, unit_cost
    INTO v_item FROM warehouse_items WHERE id = p_warehouse_item_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'warehouse_item % not found', p_warehouse_item_id; END IF;

  -- Reserve from the bin with the most available capacity
  SELECT id, allocated_quantity, reserved_quantity, available_quantity, bin_id, location_id
    INTO v_alloc
  FROM warehouse_bin_allocations
  WHERE warehouse_item_id = p_warehouse_item_id
  ORDER BY available_quantity DESC NULLS LAST
  LIMIT 1;

  IF FOUND AND v_alloc.available_quantity >= p_quantity THEN
    UPDATE warehouse_bin_allocations
      SET reserved_quantity = COALESCE(reserved_quantity,0) + p_quantity,
          updated_at = now()
      WHERE id = v_alloc.id;
  END IF;

  v_qty_before := COALESCE(v_item.current_stock, 0);

  INSERT INTO stock_transactions (
    item_id, transaction_type, reference_type, reference_id,
    quantity_change, quantity_before, quantity_after,
    unit_cost, total_value, notes, company_id, created_by,
    location_id, bin_id
  ) VALUES (
    p_warehouse_item_id, 'material_issue', 'mrn', p_reference_id,
    -p_quantity, v_qty_before, v_qty_before,
    v_item.unit_cost, COALESCE(v_item.unit_cost,0) * p_quantity,
    COALESCE(p_notes, 'Tool issued (loan)'),
    COALESCE(p_company_id, v_item.company_id), v_user,
    COALESCE(v_alloc.location_id, v_item.location_id), v_alloc.bin_id
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.tool_return_post_ledger(
  p_warehouse_item_id uuid,
  p_quantity numeric,
  p_condition text,
  p_reference_id uuid,
  p_company_id uuid,
  p_notes text DEFAULT NULL
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_alloc record;
  v_item record;
  v_user uuid := auth.uid();
  v_qty_before numeric;
  v_lost_or_damaged boolean;
BEGIN
  IF p_quantity IS NULL OR p_quantity <= 0 THEN RETURN; END IF;
  v_lost_or_damaged := p_condition IN ('lost','damaged');

  SELECT id, current_stock, location_id, company_id, unit_cost
    INTO v_item FROM warehouse_items WHERE id = p_warehouse_item_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'warehouse_item % not found', p_warehouse_item_id; END IF;

  -- Release from the bin with the most reserved
  SELECT id, allocated_quantity, reserved_quantity, bin_id, location_id
    INTO v_alloc
  FROM warehouse_bin_allocations
  WHERE warehouse_item_id = p_warehouse_item_id
  ORDER BY reserved_quantity DESC NULLS LAST
  LIMIT 1;

  IF FOUND THEN
    UPDATE warehouse_bin_allocations
      SET reserved_quantity = GREATEST(0, COALESCE(reserved_quantity,0) - p_quantity),
          allocated_quantity = CASE WHEN v_lost_or_damaged
            THEN GREATEST(0, allocated_quantity - p_quantity)
            ELSE allocated_quantity END,
          updated_at = now()
      WHERE id = v_alloc.id;
  END IF;

  v_qty_before := COALESCE(v_item.current_stock, 0);

  -- Material return ledger
  INSERT INTO stock_transactions (
    item_id, transaction_type, reference_type, reference_id,
    quantity_change, quantity_before, quantity_after,
    unit_cost, total_value, notes, company_id, created_by,
    location_id, bin_id
  ) VALUES (
    p_warehouse_item_id, 'material_return', 'mrn', p_reference_id,
    p_quantity, v_qty_before, v_qty_before,
    v_item.unit_cost, COALESCE(v_item.unit_cost,0) * p_quantity,
    COALESCE(p_notes, 'Tool returned (' || COALESCE(p_condition,'good') || ')'),
    COALESCE(p_company_id, v_item.company_id), v_user,
    COALESCE(v_alloc.location_id, v_item.location_id), v_alloc.bin_id
  );

  -- If lost/damaged, write an adjustment that actually removes inventory
  IF v_lost_or_damaged THEN
    UPDATE warehouse_items
      SET current_stock = GREATEST(0, COALESCE(current_stock,0) - p_quantity),
          updated_at = now()
      WHERE id = p_warehouse_item_id;

    INSERT INTO stock_transactions (
      item_id, transaction_type, reference_type, reference_id,
      quantity_change, quantity_before, quantity_after,
      unit_cost, total_value, notes, adjustment_reason,
      company_id, created_by, location_id, bin_id
    ) VALUES (
      p_warehouse_item_id, 'adjustment', 'adjustment', p_reference_id,
      -p_quantity, v_qty_before, GREATEST(0, v_qty_before - p_quantity),
      v_item.unit_cost, COALESCE(v_item.unit_cost,0) * p_quantity,
      'Tool write-off on return', p_condition,
      COALESCE(p_company_id, v_item.company_id), v_user,
      COALESCE(v_alloc.location_id, v_item.location_id), v_alloc.bin_id
    );
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.tool_adjustment_post_ledger(
  p_warehouse_item_id uuid,
  p_delta numeric,
  p_reason text,
  p_reference_id uuid,
  p_company_id uuid,
  p_notes text DEFAULT NULL
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_item record;
  v_alloc record;
  v_user uuid := auth.uid();
  v_qty_before numeric;
  v_qty_after numeric;
BEGIN
  IF p_delta IS NULL OR p_delta = 0 THEN RETURN; END IF;

  SELECT id, current_stock, location_id, company_id, unit_cost
    INTO v_item FROM warehouse_items WHERE id = p_warehouse_item_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'warehouse_item % not found', p_warehouse_item_id; END IF;

  v_qty_before := COALESCE(v_item.current_stock,0);
  v_qty_after := GREATEST(0, v_qty_before + p_delta);

  UPDATE warehouse_items
    SET current_stock = v_qty_after, updated_at = now()
    WHERE id = p_warehouse_item_id;

  SELECT id, bin_id, location_id, allocated_quantity
    INTO v_alloc
  FROM warehouse_bin_allocations
  WHERE warehouse_item_id = p_warehouse_item_id
  ORDER BY allocated_quantity DESC NULLS LAST
  LIMIT 1;

  IF FOUND THEN
    UPDATE warehouse_bin_allocations
      SET allocated_quantity = GREATEST(0, allocated_quantity + p_delta),
          updated_at = now()
      WHERE id = v_alloc.id;
  END IF;

  INSERT INTO stock_transactions (
    item_id, transaction_type, reference_type, reference_id,
    quantity_change, quantity_before, quantity_after,
    unit_cost, total_value, notes, adjustment_reason,
    company_id, created_by, location_id, bin_id
  ) VALUES (
    p_warehouse_item_id, 'adjustment', 'adjustment', p_reference_id,
    p_delta, v_qty_before, v_qty_after,
    v_item.unit_cost, COALESCE(v_item.unit_cost,0) * abs(p_delta),
    COALESCE(p_notes, 'Tool quantity adjustment'), p_reason,
    COALESCE(p_company_id, v_item.company_id), v_user,
    COALESCE(v_alloc.location_id, v_item.location_id), v_alloc.bin_id
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.tool_issue_post_ledger(uuid,numeric,uuid,uuid,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.tool_return_post_ledger(uuid,numeric,text,uuid,uuid,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.tool_adjustment_post_ledger(uuid,numeric,text,uuid,uuid,text) TO authenticated;