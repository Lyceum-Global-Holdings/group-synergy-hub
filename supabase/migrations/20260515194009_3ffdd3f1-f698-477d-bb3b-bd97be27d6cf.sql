-- =========================================================
-- Relax purge_inactive_inventory_item: drop 30-day cooldown
-- and the "must be Inactive first" precondition.
-- =========================================================
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
  v_actor    uuid := auth.uid();
  v_item     public.warehouse_items%ROWTYPE;
  v_blocking text[] := ARRAY[]::text[];
  v_count    integer;
BEGIN
  IF v_actor IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF NOT (public.has_role(v_actor, 'admin') OR public.has_role(v_actor, 'super_admin')) THEN
    RAISE EXCEPTION 'Access denied: admin role required to purge inventory items';
  END IF;

  IF p_reason IS NULL OR length(btrim(p_reason)) < 5 THEN
    RAISE EXCEPTION 'A reason of at least 5 characters is required for a permanent purge';
  END IF;

  SELECT * INTO v_item FROM public.warehouse_items WHERE id = p_item_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Item % not found', p_item_id;
  END IF;

  IF v_item.company_id IS NOT NULL
     AND NOT public.can_access_company(v_actor, v_item.company_id) THEN
    RAISE EXCEPTION 'Access denied: cannot purge items in another company';
  END IF;

  IF COALESCE(v_item.current_stock, 0) <> 0 THEN
    RAISE EXCEPTION 'Cannot purge item % — current stock is %', v_item.item_code, v_item.current_stock;
  END IF;

  -- Zero-reference check (every FK-bearing table)
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

  -- Auto-flag Inactive in the same tx (SAP MM06 deletion-flag pattern)
  IF v_item.status IS DISTINCT FROM 'inactive' THEN
    UPDATE public.warehouse_items SET status = 'inactive' WHERE id = p_item_id;
    v_item.status := 'inactive';
  END IF;

  -- Audit BEFORE delete (snapshot)
  INSERT INTO security_audit_log (changed_by, action, before_value, after_value)
  VALUES (
    v_actor,
    'purge_inventory_item',
    to_jsonb(v_item),
    jsonb_build_object('reason', p_reason, 'item_id', p_item_id, 'item_code', v_item.item_code, 'company_id', v_item.company_id)
  );

  DELETE FROM public.warehouse_items WHERE id = p_item_id;

  RETURN jsonb_build_object('id', p_item_id, 'item_code', v_item.item_code, 'status', 'purged');
END;
$$;

REVOKE ALL ON FUNCTION public.purge_inactive_inventory_item(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.purge_inactive_inventory_item(uuid, text) TO authenticated;

-- =========================================================
-- Eligibility check — one row per item id
-- =========================================================
CREATE OR REPLACE FUNCTION public.check_inventory_purge_eligibility(
  p_item_ids uuid[]
)
RETURNS TABLE (
  id            uuid,
  item_code     text,
  eligible      boolean,
  current_stock numeric,
  blocking_refs text[]
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor uuid := auth.uid();
  v_id    uuid;
  v_item  public.warehouse_items%ROWTYPE;
  v_refs  text[];
  v_count integer;
BEGIN
  IF v_actor IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF p_item_ids IS NULL OR array_length(p_item_ids, 1) IS NULL THEN
    RETURN;
  END IF;

  FOREACH v_id IN ARRAY p_item_ids LOOP
    SELECT * INTO v_item FROM public.warehouse_items WHERE warehouse_items.id = v_id;
    IF NOT FOUND THEN CONTINUE; END IF;

    IF v_item.company_id IS NOT NULL
       AND NOT public.can_access_company(v_actor, v_item.company_id) THEN
      CONTINUE;
    END IF;

    v_refs := ARRAY[]::text[];

    SELECT count(*) INTO v_count FROM stock_transactions WHERE item_id = v_id;
    IF v_count > 0 THEN v_refs := array_append(v_refs, format('stock_transactions (%s)', v_count)); END IF;

    SELECT count(*) INTO v_count FROM warehouse_bin_allocations WHERE warehouse_item_id = v_id;
    IF v_count > 0 THEN v_refs := array_append(v_refs, format('warehouse_bin_allocations (%s)', v_count)); END IF;

    SELECT count(*) INTO v_count FROM item_batches WHERE warehouse_item_id = v_id;
    IF v_count > 0 THEN v_refs := array_append(v_refs, format('item_batches (%s)', v_count)); END IF;

    SELECT count(*) INTO v_count FROM warehouse_partial_pieces WHERE parent_item_id = v_id;
    IF v_count > 0 THEN v_refs := array_append(v_refs, format('warehouse_partial_pieces (%s)', v_count)); END IF;

    SELECT count(*) INTO v_count FROM warehouse_item_reservations WHERE warehouse_item_id = v_id;
    IF v_count > 0 THEN v_refs := array_append(v_refs, format('warehouse_item_reservations (%s)', v_count)); END IF;

    SELECT count(*) INTO v_count FROM warehouse_stock_movements WHERE warehouse_item_id = v_id;
    IF v_count > 0 THEN v_refs := array_append(v_refs, format('warehouse_stock_movements (%s)', v_count)); END IF;

    SELECT count(*) INTO v_count FROM bill_of_materials WHERE warehouse_item_id = v_id;
    IF v_count > 0 THEN v_refs := array_append(v_refs, format('bill_of_materials (%s)', v_count)); END IF;

    SELECT count(*) INTO v_count FROM bom_items WHERE warehouse_item_id = v_id;
    IF v_count > 0 THEN v_refs := array_append(v_refs, format('bom_items (%s)', v_count)); END IF;

    SELECT count(*) INTO v_count FROM bom_item_substitutions WHERE substitute_item_id = v_id;
    IF v_count > 0 THEN v_refs := array_append(v_refs, format('bom_item_substitutions (%s)', v_count)); END IF;

    SELECT count(*) INTO v_count FROM po_items WHERE warehouse_item_id = v_id;
    IF v_count > 0 THEN v_refs := array_append(v_refs, format('po_items (%s)', v_count)); END IF;

    SELECT count(*) INTO v_count FROM pr_items WHERE warehouse_item_id = v_id;
    IF v_count > 0 THEN v_refs := array_append(v_refs, format('pr_items (%s)', v_count)); END IF;

    SELECT count(*) INTO v_count FROM blanket_po_items WHERE warehouse_item_id = v_id;
    IF v_count > 0 THEN v_refs := array_append(v_refs, format('blanket_po_items (%s)', v_count)); END IF;

    SELECT count(*) INTO v_count FROM rfq_rfp_items WHERE warehouse_item_id = v_id;
    IF v_count > 0 THEN v_refs := array_append(v_refs, format('rfq_rfp_items (%s)', v_count)); END IF;

    SELECT count(*) INTO v_count FROM material_issue_items WHERE item_id = v_id;
    IF v_count > 0 THEN v_refs := array_append(v_refs, format('material_issue_items (%s)', v_count)); END IF;

    SELECT count(*) INTO v_count FROM material_request_items WHERE item_id = v_id;
    IF v_count > 0 THEN v_refs := array_append(v_refs, format('material_request_items (%s)', v_count)); END IF;

    SELECT count(*) INTO v_count FROM material_return_items WHERE item_id = v_id;
    IF v_count > 0 THEN v_refs := array_append(v_refs, format('material_return_items (%s)', v_count)); END IF;

    SELECT count(*) INTO v_count FROM stock_transfer_items WHERE warehouse_item_id = v_id;
    IF v_count > 0 THEN v_refs := array_append(v_refs, format('stock_transfer_items (%s)', v_count)); END IF;

    SELECT count(*) INTO v_count FROM putaway_items WHERE warehouse_item_id = v_id;
    IF v_count > 0 THEN v_refs := array_append(v_refs, format('putaway_items (%s)', v_count)); END IF;

    SELECT count(*) INTO v_count FROM finished_goods WHERE warehouse_item_id = v_id;
    IF v_count > 0 THEN v_refs := array_append(v_refs, format('finished_goods (%s)', v_count)); END IF;

    SELECT count(*) INTO v_count FROM supplier_items WHERE warehouse_item_id = v_id;
    IF v_count > 0 THEN v_refs := array_append(v_refs, format('supplier_items (%s)', v_count)); END IF;

    SELECT count(*) INTO v_count FROM supplier_evaluation_entries WHERE warehouse_item_id = v_id;
    IF v_count > 0 THEN v_refs := array_append(v_refs, format('supplier_evaluation_entries (%s)', v_count)); END IF;

    SELECT count(*) INTO v_count FROM supplier_evaluations WHERE warehouse_item_id = v_id;
    IF v_count > 0 THEN v_refs := array_append(v_refs, format('supplier_evaluations (%s)', v_count)); END IF;

    SELECT count(*) INTO v_count FROM floor_room_materials WHERE warehouse_item_id = v_id;
    IF v_count > 0 THEN v_refs := array_append(v_refs, format('floor_room_materials (%s)', v_count)); END IF;

    SELECT count(*) INTO v_count FROM floor_room_material_transactions WHERE warehouse_item_id = v_id;
    IF v_count > 0 THEN v_refs := array_append(v_refs, format('floor_room_material_transactions (%s)', v_count)); END IF;

    id            := v_id;
    item_code     := v_item.item_code;
    current_stock := COALESCE(v_item.current_stock, 0);
    blocking_refs := v_refs;
    eligible      := (COALESCE(v_item.current_stock, 0) = 0)
                     AND (array_length(v_refs, 1) IS NULL);
    RETURN NEXT;
  END LOOP;
END;
$$;

REVOKE ALL ON FUNCTION public.check_inventory_purge_eligibility(uuid[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.check_inventory_purge_eligibility(uuid[]) TO authenticated;