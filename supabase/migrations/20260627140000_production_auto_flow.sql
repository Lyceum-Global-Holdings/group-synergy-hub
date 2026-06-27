-- Production optimization — Phase 1: server-side stage roll-up & auto-flow.
--
-- Daily entries are the source of truth: a stage's output/wastage = SUM of its
-- daily entries. A stage's input rolls forward from the previous stage's output
-- (first stage uses the order target). The order status auto-derives from its
-- stages (auto-start on first activity, auto-complete when all stages done).
-- All enforced by triggers so it is correct regardless of the client.

CREATE OR REPLACE FUNCTION public.sync_production_order(p_order_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_target      integer;
  v_order_status text;
  v_prev_output integer := NULL;   -- NULL → first stage uses target
  v_stage       record;
  v_out         integer;
  v_waste       integer;
  v_in          integer;
  v_count       integer := 0;
  v_all_done    boolean := true;
  v_any_active  boolean := false;
BEGIN
  SELECT target_qty, status INTO v_target, v_order_status
    FROM public.production_orders WHERE id = p_order_id;
  IF NOT FOUND OR v_order_status = 'cancelled' THEN RETURN; END IF;

  FOR v_stage IN
    SELECT id, status FROM public.production_order_stages
     WHERE order_id = p_order_id
     ORDER BY sequence_order, created_at
  LOOP
    v_count := v_count + 1;

    SELECT COALESCE(SUM(output_qty), 0), COALESCE(SUM(wastage_qty), 0)
      INTO v_out, v_waste
      FROM public.production_daily_entries WHERE stage_id = v_stage.id;

    v_in := COALESCE(v_prev_output, v_target, 0);

    UPDATE public.production_order_stages
       SET input_qty = v_in, output_qty = v_out, wastage_qty = v_waste, updated_at = now()
     WHERE id = v_stage.id;

    IF v_stage.status <> 'completed' THEN v_all_done := false; END IF;
    IF v_stage.status IN ('in_progress', 'completed') THEN v_any_active := true; END IF;

    v_prev_output := v_out;  -- good output flows to the next stage's input
  END LOOP;

  IF v_count > 0 AND v_all_done THEN
    UPDATE public.production_orders
       SET status = 'completed', completed_date = COALESCE(completed_date, CURRENT_DATE), updated_at = now()
     WHERE id = p_order_id AND status <> 'completed';
  ELSIF v_any_active THEN
    UPDATE public.production_orders
       SET status = 'in_progress', completed_date = NULL, updated_at = now()
     WHERE id = p_order_id AND status = 'planned';
  END IF;
END;
$$;

-- Daily entries change → resync the parent order.
CREATE OR REPLACE FUNCTION public.trg_production_daily_sync()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE v_order uuid;
BEGIN
  SELECT order_id INTO v_order FROM public.production_order_stages
   WHERE id = COALESCE(NEW.stage_id, OLD.stage_id);
  IF v_order IS NOT NULL THEN PERFORM public.sync_production_order(v_order); END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_prod_daily_sync ON public.production_daily_entries;
CREATE TRIGGER trg_prod_daily_sync
  AFTER INSERT OR UPDATE OR DELETE ON public.production_daily_entries
  FOR EACH ROW EXECUTE FUNCTION public.trg_production_daily_sync();

-- Stage status change → resync (rolls input forward + updates order status).
-- Fires only on status change, so sync's qty updates don't recurse.
CREATE OR REPLACE FUNCTION public.trg_production_stage_status_sync()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  PERFORM public.sync_production_order(NEW.order_id);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_prod_stage_status_sync ON public.production_order_stages;
CREATE TRIGGER trg_prod_stage_status_sync
  AFTER UPDATE OF status ON public.production_order_stages
  FOR EACH ROW WHEN (OLD.status IS DISTINCT FROM NEW.status)
  EXECUTE FUNCTION public.trg_production_stage_status_sync();

-- When stages are first created for an order, set their rolled input baseline.
DROP TRIGGER IF EXISTS trg_prod_stage_insert_sync ON public.production_order_stages;
CREATE OR REPLACE FUNCTION public.trg_production_stage_insert_sync()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  PERFORM public.sync_production_order(NEW.order_id);
  RETURN NEW;
END;
$$;
CREATE TRIGGER trg_prod_stage_insert_sync
  AFTER INSERT ON public.production_order_stages
  FOR EACH ROW EXECUTE FUNCTION public.trg_production_stage_insert_sync();

GRANT EXECUTE ON FUNCTION public.sync_production_order(uuid) TO authenticated;

-- Backfill: make all existing orders consistent with the new rules.
DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT id FROM public.production_orders LOOP
    PERFORM public.sync_production_order(r.id);
  END LOOP;
END$$;
