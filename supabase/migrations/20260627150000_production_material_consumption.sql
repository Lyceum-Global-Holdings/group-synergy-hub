-- Production optimization — Phase 3: consume materials into inventory.
--
-- A stage's BOM-linked cost lines (those whose bom_item maps to a warehouse
-- item) can be "issued" — deducted from a chosen warehouse location via the
-- existing FIFO primitive. Idempotent (each line tracked by consumed_qty) and
-- per-line safe (a line that can't be fully covered is reported, not deducted).

ALTER TABLE public.production_stage_costs
  ADD COLUMN IF NOT EXISTS consumed_qty numeric(12,4) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS consumed_at  timestamptz,
  ADD COLUMN IF NOT EXISTS consumed_by  uuid;

CREATE OR REPLACE FUNCTION public.issue_production_stage_materials(
  p_stage_id uuid, p_location_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_uid    uuid := auth.uid();
  v_order  public.production_orders;
  v_psc    record;
  v_qty    numeric;
  v_ref    text;
  v_issued jsonb := '[]'::jsonb;
  v_short  jsonb := '[]'::jsonb;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Authentication required'; END IF;
  IF p_location_id IS NULL THEN RAISE EXCEPTION 'Source location is required'; END IF;

  SELECT po.* INTO v_order
    FROM public.production_order_stages pos
    JOIN public.production_orders po ON po.id = pos.order_id
   WHERE pos.id = p_stage_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Production stage % not found', p_stage_id; END IF;
  IF NOT public.can_access_company(v_order.company_id) THEN
    RAISE EXCEPTION 'Not allowed for this company';
  END IF;

  v_ref := 'PROD-' || COALESCE(v_order.order_number, v_order.id::text);

  FOR v_psc IN
    SELECT psc.id, psc.item_name, psc.quantity_used, COALESCE(psc.consumed_qty, 0) AS consumed_qty,
           bi.warehouse_item_id
      FROM public.production_stage_costs psc
      JOIN public.bom_items bi ON bi.id = psc.bom_item_id
     WHERE psc.stage_id = p_stage_id
       AND bi.warehouse_item_id IS NOT NULL
       AND psc.quantity_used > COALESCE(psc.consumed_qty, 0)
  LOOP
    v_qty := v_psc.quantity_used - v_psc.consumed_qty;
    BEGIN
      PERFORM public.process_material_issue_stock_update(
        v_psc.warehouse_item_id, v_qty, p_location_id, NULL, NULL, v_ref);

      UPDATE public.production_stage_costs
         SET consumed_qty = quantity_used, consumed_at = now(), consumed_by = v_uid, updated_at = now()
       WHERE id = v_psc.id;

      v_issued := v_issued || jsonb_build_object('item', v_psc.item_name, 'qty', v_qty);
    EXCEPTION WHEN OTHERS THEN
      -- Insufficient stock or any per-line failure: report, leave line un-issued.
      v_short := v_short || jsonb_build_object('item', v_psc.item_name, 'qty', v_qty, 'error', SQLERRM);
    END;
  END LOOP;

  RETURN jsonb_build_object('issued', v_issued, 'shortfalls', v_short, 'reference', v_ref);
END;
$$;

GRANT EXECUTE ON FUNCTION public.issue_production_stage_materials(uuid, uuid) TO authenticated;
