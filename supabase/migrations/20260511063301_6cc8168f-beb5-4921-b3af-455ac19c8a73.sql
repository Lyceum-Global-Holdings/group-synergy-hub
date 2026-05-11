
-- 1) Backfill audit table
CREATE TABLE IF NOT EXISTS public.stock_ledger_backfill_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  scope text NOT NULL,
  item_id uuid,
  bin_id uuid,
  location_id uuid,
  expected_latest_after numeric,
  observed_latest_after numeric,
  drift numeric,
  rows_touched integer,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.stock_ledger_backfill_audit ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admins read backfill audit" ON public.stock_ledger_backfill_audit;
CREATE POLICY "Admins read backfill audit" ON public.stock_ledger_backfill_audit
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin'));

-- 2) BEFORE INSERT trigger to set quantity_before / quantity_after from live state
CREATE OR REPLACE FUNCTION public.set_stock_transaction_balances()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_before numeric := 0;
BEGIN
  IF NEW.bin_id IS NOT NULL AND NEW.item_id IS NOT NULL THEN
    SELECT COALESCE(allocated_quantity, 0) INTO v_before
    FROM public.warehouse_bin_allocations
    WHERE warehouse_item_id = NEW.item_id AND bin_id = NEW.bin_id
    LIMIT 1;
    v_before := COALESCE(v_before, 0);
  ELSIF NEW.location_id IS NOT NULL AND NEW.item_id IS NOT NULL THEN
    SELECT COALESCE(SUM(wba.allocated_quantity), 0) INTO v_before
    FROM public.warehouse_bin_allocations wba
    JOIN public.warehouse_bins wb ON wb.id = wba.bin_id
    WHERE wba.warehouse_item_id = NEW.item_id
      AND wb.location_id = NEW.location_id;
  ELSIF NEW.item_id IS NOT NULL THEN
    SELECT COALESCE(current_stock, 0) INTO v_before
    FROM public.warehouse_items
    WHERE id = NEW.item_id;
  END IF;

  NEW.quantity_before := COALESCE(v_before, 0);
  NEW.quantity_after  := COALESCE(v_before, 0) + COALESCE(NEW.quantity_change, 0);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_set_stock_transaction_balances ON public.stock_transactions;
CREATE TRIGGER trg_set_stock_transaction_balances
  BEFORE INSERT ON public.stock_transactions
  FOR EACH ROW EXECUTE FUNCTION public.set_stock_transaction_balances();

-- 3) Reader RPC: trust stored before/after; keep scoping logic
CREATE OR REPLACE FUNCTION public.get_bin_scoped_stock_movements(
  p_item_id uuid,
  p_location_id uuid DEFAULT NULL,
  p_bin_id uuid DEFAULT NULL
)
RETURNS TABLE(
  id uuid, created_at timestamptz, transaction_type text, reference_type text,
  reference_id uuid, bin_id uuid, bin_code text, bin_name text,
  location_id uuid, location_code text, location_name text,
  quantity_change numeric, quantity_before numeric, quantity_after numeric,
  unit_cost numeric, total_value numeric, notes text, created_by uuid
)
LANGUAGE sql STABLE SET search_path TO 'public' AS $$
  SELECT
    st.id, st.created_at, st.transaction_type::text, st.reference_type::text,
    st.reference_id, st.bin_id, wb.bin_code, wb.name AS bin_name,
    COALESCE(wb.location_id, st.location_id) AS location_id,
    wl.location_code, wl.name AS location_name,
    st.quantity_change, st.quantity_before, st.quantity_after,
    st.unit_cost, st.total_value, st.notes, st.created_by
  FROM public.stock_transactions st
  LEFT JOIN public.warehouse_bins wb ON wb.id = st.bin_id
  LEFT JOIN public.warehouse_locations wl ON wl.id = COALESCE(wb.location_id, st.location_id)
  WHERE st.item_id = p_item_id
    AND (
      (p_bin_id IS NOT NULL AND st.bin_id = p_bin_id)
      OR (p_bin_id IS NULL AND (
        p_location_id IS NULL
        OR wb.location_id = p_location_id
        OR (st.bin_id IS NULL AND st.location_id = p_location_id)
      ))
    )
  ORDER BY st.created_at DESC, st.id DESC;
$$;

-- 4) Backfill: anchor each (item,bin) group's latest qty_after to live allocated_quantity, walk back
DO $backfill$
DECLARE
  r RECORD;
  v_anchor numeric;
  v_after numeric;
  v_before numeric;
  v_count integer;
  v_first_after numeric;
BEGIN
  -- Per (item_id, bin_id)
  FOR r IN
    SELECT DISTINCT st.item_id, st.bin_id
    FROM public.stock_transactions st
    WHERE st.bin_id IS NOT NULL
  LOOP
    SELECT COALESCE(allocated_quantity, 0) INTO v_anchor
    FROM public.warehouse_bin_allocations
    WHERE warehouse_item_id = r.item_id AND bin_id = r.bin_id
    LIMIT 1;
    v_anchor := COALESCE(v_anchor, 0);

    v_after := v_anchor;
    v_count := 0;
    v_first_after := NULL;

    FOR v_before IN
      SELECT NULL::numeric -- placeholder, real loop below
    LOOP NULL; END LOOP;

    -- Walk newest -> oldest
    DECLARE
      cur CURSOR FOR
        SELECT id, quantity_change, quantity_after
        FROM public.stock_transactions
        WHERE item_id = r.item_id AND bin_id = r.bin_id
        ORDER BY created_at DESC, id DESC;
      rec RECORD;
    BEGIN
      OPEN cur;
      LOOP
        FETCH cur INTO rec;
        EXIT WHEN NOT FOUND;
        IF v_first_after IS NULL THEN v_first_after := rec.quantity_after; END IF;
        v_before := v_after - COALESCE(rec.quantity_change, 0);
        UPDATE public.stock_transactions
          SET quantity_before = v_before, quantity_after = v_after
          WHERE id = rec.id;
        v_after := v_before;
        v_count := v_count + 1;
      END LOOP;
      CLOSE cur;
    END;

    INSERT INTO public.stock_ledger_backfill_audit
      (scope, item_id, bin_id, expected_latest_after, observed_latest_after, drift, rows_touched)
    VALUES ('bin', r.item_id, r.bin_id, v_anchor, v_first_after,
            COALESCE(v_anchor,0) - COALESCE(v_first_after,0), v_count);
  END LOOP;

  -- Per (item_id, location_id) for rows with NULL bin
  FOR r IN
    SELECT DISTINCT st.item_id, st.location_id
    FROM public.stock_transactions st
    WHERE st.bin_id IS NULL AND st.location_id IS NOT NULL
  LOOP
    SELECT COALESCE(SUM(wba.allocated_quantity), 0) INTO v_anchor
    FROM public.warehouse_bin_allocations wba
    JOIN public.warehouse_bins wb ON wb.id = wba.bin_id
    WHERE wba.warehouse_item_id = r.item_id AND wb.location_id = r.location_id;
    v_anchor := COALESCE(v_anchor, 0);

    v_after := v_anchor;
    v_count := 0;
    v_first_after := NULL;

    DECLARE
      cur CURSOR FOR
        SELECT id, quantity_change, quantity_after
        FROM public.stock_transactions
        WHERE item_id = r.item_id AND bin_id IS NULL AND location_id = r.location_id
        ORDER BY created_at DESC, id DESC;
      rec RECORD;
    BEGIN
      OPEN cur;
      LOOP
        FETCH cur INTO rec;
        EXIT WHEN NOT FOUND;
        IF v_first_after IS NULL THEN v_first_after := rec.quantity_after; END IF;
        v_before := v_after - COALESCE(rec.quantity_change, 0);
        UPDATE public.stock_transactions
          SET quantity_before = v_before, quantity_after = v_after
          WHERE id = rec.id;
        v_after := v_before;
        v_count := v_count + 1;
      END LOOP;
      CLOSE cur;
    END;

    INSERT INTO public.stock_ledger_backfill_audit
      (scope, item_id, location_id, expected_latest_after, observed_latest_after, drift, rows_touched)
    VALUES ('location', r.item_id, r.location_id, v_anchor, v_first_after,
            COALESCE(v_anchor,0) - COALESCE(v_first_after,0), v_count);
  END LOOP;
END
$backfill$;
