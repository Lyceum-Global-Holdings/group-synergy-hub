
-- Single-item purge
CREATE OR REPLACE FUNCTION public.purge_inactive_inventory_item(
  p_item_id uuid,
  p_reason  text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor       uuid := auth.uid();
  v_item        public.warehouse_items%ROWTYPE;
  v_blocking    text[] := ARRAY[]::text[];
  v_count       integer;
  v_min_days    integer := 30;
  v_inactive_at timestamptz;
BEGIN
  IF v_actor IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- 1) Must be admin or super_admin
  IF NOT (public.has_role(v_actor, 'admin') OR public.has_role(v_actor, 'super_admin')) THEN
    RAISE EXCEPTION 'Access denied: admin role required to purge inventory items';
  END IF;

  IF p_reason IS NULL OR length(btrim(p_reason)) < 5 THEN
    RAISE EXCEPTION 'A reason of at least 5 characters is required for a permanent purge';
  END IF;

  -- 2) Load item
  SELECT * INTO v_item FROM public.warehouse_items WHERE id = p_item_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Item % not found', p_item_id;
  END IF;

  -- 3) Company access
  IF v_item.company_id IS NOT NULL
     AND NOT public.can_access_company(v_actor, v_item.company_id) THEN
    RAISE EXCEPTION 'Access denied: cannot purge items in another company';
  END IF;

  -- 4) Must be Inactive
  IF v_item.status IS DISTINCT FROM 'inactive' THEN
    RAISE EXCEPTION 'Item must be marked Inactive before it can be permanently deleted (current status: %)', v_item.status;
  END IF;

  -- 5) Must have been Inactive long enough (>= 30 days)
  v_inactive_at := COALESCE(v_item.updated_at, v_item.created_at);
  IF v_inactive_at > now() - make_interval(days => v_min_days) THEN
    RAISE EXCEPTION 'Item must remain Inactive for at least % days before purging (last status change: %)',
      v_min_days, v_inactive_at;
  END IF;

  -- 6) Zero-reference check across every FK-bearing table
  -- Helper macro via dynamic checks:
  PERFORM 1;

  SELECT count(*) INTO v_count FROM stock_transactions WHERE item_id = p_item_id;
  IF v_count > 0 THEN v_blocking := array_append(v_blocking, format('stock_transactions (%s)', v_count)); END IF;

  SELECT count(*) INTO v_count FROM warehouse_bin_allocations WHERE warehouse_item_id = p_item_id;
  IF v_count > 0 THEN v_blocking := array_append(v_blocking, format('warehouse_bin_allocations (%s)', v_count)); END IF;

  SELECT count(*) INTO v_count FROM item_batches WHERE warehouse_item_id = p_item_id;
  IF v_count > 0 THEN v_blocking := array_append(v_blocking, format('item_batches (%s)', v_count)); END IF;

  SELECT count(*) INTO v_count FROM warehouse_partial_pieces WHERE parent_item_id = p_item_id;
  IF v_count > 0 THEN v_blocking := array_append(v_blocking, format('warehouse_partial_pieces (%s)', v_count)); END IF;

  SELECT count(*) INTO v_count FROM warehouse_item_reservations WHERE warehouse_item_id = p_item_id;
  IF v_count > 0 THEN v_blocking := array_append(v_blocking, format('warehouse_item_reservations (%s)', v_count)); END IF;

  SELECT count(*) INTO v_count FROM warehouse_stock_movements WHERE warehouse_item_id = p_item_id;
  IF v_count > 0 THEN v_blocking := array_append(v_blocking, format('warehouse_stock_movements (%s)', v_count)); END IF;

  SELECT count(*) INTO v_count FROM bill_of_materials WHERE warehouse_item_id = p_item_id;
  IF v_count > 0 THEN v_blocking := array_append(v_blocking, format('bill_of_materials (%s)', v_count)); END IF;

  SELECT count(*) INTO v_count FROM bom_items WHERE warehouse_item_id = p_item_id;
  IF v_count > 0 THEN v_blocking := array_append(v_blocking, format('bom_items (%s)', v_count)); END IF;

  SELECT count(*) INTO v_count FROM bom_item_substitutions WHERE substitute_item_id = p_item_id;
  IF v_count > 0 THEN v_blocking := array_append(v_blocking, format('bom_item_substitutions (%s)', v_count)); END IF;

  SELECT count(*) INTO v_count FROM po_items WHERE warehouse_item_id = p_item_id;
  IF v_count > 0 THEN v_blocking := array_append(v_blocking, format('po_items (%s)', v_count)); END IF;

  SELECT count(*) INTO v_count FROM pr_items WHERE warehouse_item_id = p_item_id;
  IF v_count > 0 THEN v_blocking := array_append(v_blocking, format('pr_items (%s)', v_count)); END IF;

  SELECT count(*) INTO v_count FROM blanket_po_items WHERE warehouse_item_id = p_item_id;
  IF v_count > 0 THEN v_blocking := array_append(v_blocking, format('blanket_po_items (%s)', v_count)); END IF;

  SELECT count(*) INTO v_count FROM rfq_rfp_items WHERE warehouse_item_id = p_item_id;
  IF v_count > 0 THEN v_blocking := array_append(v_blocking, format('rfq_rfp_items (%s)', v_count)); END IF;

  SELECT count(*) INTO v_count FROM material_issue_items WHERE item_id = p_item_id;
  IF v_count > 0 THEN v_blocking := array_append(v_blocking, format('material_issue_items (%s)', v_count)); END IF;

  SELECT count(*) INTO v_count FROM material_request_items WHERE item_id = p_item_id;
  IF v_count > 0 THEN v_blocking := array_append(v_blocking, format('material_request_items (%s)', v_count)); END IF;

  SELECT count(*) INTO v_count FROM material_return_items WHERE item_id = p_item_id;
  IF v_count > 0 THEN v_blocking := array_append(v_blocking, format('material_return_items (%s)', v_count)); END IF;

  SELECT count(*) INTO v_count FROM stock_transfer_items WHERE warehouse_item_id = p_item_id;
  IF v_count > 0 THEN v_blocking := array_append(v_blocking, format('stock_transfer_items (%s)', v_count)); END IF;

  SELECT count(*) INTO v_count FROM putaway_items WHERE warehouse_item_id = p_item_id;
  IF v_count > 0 THEN v_blocking := array_append(v_blocking, format('putaway_items (%s)', v_count)); END IF;

  SELECT count(*) INTO v_count FROM finished_goods WHERE warehouse_item_id = p_item_id;
  IF v_count > 0 THEN v_blocking := array_append(v_blocking, format('finished_goods (%s)', v_count)); END IF;

  SELECT count(*) INTO v_count FROM supplier_items WHERE warehouse_item_id = p_item_id;
  IF v_count > 0 THEN v_blocking := array_append(v_blocking, format('supplier_items (%s)', v_count)); END IF;

  SELECT count(*) INTO v_count FROM supplier_evaluation_entries WHERE warehouse_item_id = p_item_id;
  IF v_count > 0 THEN v_blocking := array_append(v_blocking, format('supplier_evaluation_entries (%s)', v_count)); END IF;

  SELECT count(*) INTO v_count FROM supplier_evaluations WHERE warehouse_item_id = p_item_id;
  IF v_count > 0 THEN v_blocking := array_append(v_blocking, format('supplier_evaluations (%s)', v_count)); END IF;

  SELECT count(*) INTO v_count FROM floor_room_materials WHERE warehouse_item_id = p_item_id;
  IF v_count > 0 THEN v_blocking := array_append(v_blocking, format('floor_room_materials (%s)', v_count)); END IF;

  SELECT count(*) INTO v_count FROM floor_room_material_transactions WHERE warehouse_item_id = p_item_id;
  IF v_count > 0 THEN v_blocking := array_append(v_blocking, format('floor_room_material_transactions (%s)', v_count)); END IF;

  IF array_length(v_blocking, 1) > 0 THEN
    RAISE EXCEPTION 'Cannot purge: item is still referenced in: %', array_to_string(v_blocking, ', ');
  END IF;

  -- 7) Audit BEFORE delete (snapshot)
  INSERT INTO security_audit_log (changed_by, action, before_value, after_value)
  VALUES (
    v_actor,
    'purge_inventory_item',
    to_jsonb(v_item),
    jsonb_build_object('reason', p_reason, 'item_id', p_item_id, 'item_code', v_item.item_code, 'company_id', v_item.company_id)
  );

  -- 8) Hard delete
  DELETE FROM public.warehouse_items WHERE id = p_item_id;

  RETURN jsonb_build_object(
    'id',        p_item_id,
    'item_code', v_item.item_code,
    'status',    'purged'
  );
END;
$$;

REVOKE ALL ON FUNCTION public.purge_inactive_inventory_item(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.purge_inactive_inventory_item(uuid, text) TO authenticated;

-- Bulk purge — returns one row per input id with status + message
CREATE OR REPLACE FUNCTION public.purge_inactive_inventory_items_bulk(
  p_item_ids uuid[],
  p_reason   text
)
RETURNS TABLE (id uuid, status text, message text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id     uuid;
  v_result jsonb;
BEGIN
  IF p_item_ids IS NULL OR array_length(p_item_ids, 1) IS NULL THEN
    RETURN;
  END IF;

  FOREACH v_id IN ARRAY p_item_ids LOOP
    BEGIN
      v_result := public.purge_inactive_inventory_item(v_id, p_reason);
      id := v_id;
      status := 'purged';
      message := NULL;
      RETURN NEXT;
    EXCEPTION WHEN OTHERS THEN
      id := v_id;
      status := 'blocked';
      message := SQLERRM;
      RETURN NEXT;
    END;
  END LOOP;
END;
$$;

REVOKE ALL ON FUNCTION public.purge_inactive_inventory_items_bulk(uuid[], text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.purge_inactive_inventory_items_bulk(uuid[], text) TO authenticated;
