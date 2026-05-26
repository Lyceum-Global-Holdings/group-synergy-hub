
-- =========================================================
-- 1. Hierarchy-aware overload (6 args, no secondary)
-- =========================================================
CREATE OR REPLACE FUNCTION public.process_material_issue_stock_update(
  p_item_id uuid,
  p_quantity_issued numeric,
  p_location_id uuid,
  p_bin_allocation_id uuid DEFAULT NULL::uuid,
  p_min_id uuid DEFAULT NULL::uuid,
  p_min_number text DEFAULT NULL::text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_item RECORD;
  v_alloc RECORD;
  v_available numeric := 0;
  v_remaining numeric := p_quantity_issued;
  v_take numeric;
  v_before numeric;
  v_company_id uuid;
  v_bin_id uuid;
  v_bin_loc uuid;
BEGIN
  IF p_location_id IS NULL THEN
    RAISE EXCEPTION 'Location is required for material issue';
  END IF;
  IF p_quantity_issued IS NULL OR p_quantity_issued <= 0 THEN
    RAISE EXCEPTION 'Quantity issued must be positive';
  END IF;

  IF p_min_id IS NOT NULL THEN
    SELECT company_id INTO v_company_id FROM material_issue_notes WHERE id = p_min_id;
  END IF;

  SELECT * INTO v_item FROM warehouse_items WHERE id = p_item_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Warehouse item not found: %', p_item_id;
  END IF;

  -- Resolve location subtree (location + all descendants)
  WITH RECURSIVE loc_tree AS (
    SELECT id FROM warehouse_locations WHERE id = p_location_id
    UNION ALL
    SELECT wl.id FROM warehouse_locations wl JOIN loc_tree t ON wl.parent_id = t.id
  )
  SELECT COALESCE(SUM(GREATEST(0, wba.allocated_quantity - COALESCE(wba.reserved_quantity, 0))), 0)
    INTO v_available
  FROM warehouse_bin_allocations wba
  JOIN warehouse_bins wb ON wb.id = wba.bin_id
  WHERE wba.warehouse_item_id = p_item_id
    AND wb.location_id IN (SELECT id FROM loc_tree);

  IF v_available < p_quantity_issued THEN
    RAISE EXCEPTION 'Insufficient stock at selected location (incl. sub-locations). Available: %, Requested: %',
      v_available, p_quantity_issued;
  END IF;

  IF p_bin_allocation_id IS NOT NULL THEN
    PERFORM 1
    FROM warehouse_bin_allocations wba
    JOIN warehouse_bins wb ON wb.id = wba.bin_id
    WHERE wba.id = p_bin_allocation_id
      AND wba.warehouse_item_id = p_item_id
      AND wb.location_id IN (
        WITH RECURSIVE lt AS (
          SELECT id FROM warehouse_locations WHERE id = p_location_id
          UNION ALL
          SELECT wl.id FROM warehouse_locations wl JOIN lt t2 ON wl.parent_id = t2.id
        ) SELECT id FROM lt
      );
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Selected bin does not belong to the issue location subtree';
    END IF;
  END IF;

  FOR v_alloc IN
    WITH RECURSIVE loc_tree AS (
      SELECT id FROM warehouse_locations WHERE id = p_location_id
      UNION ALL
      SELECT wl.id FROM warehouse_locations wl JOIN loc_tree t ON wl.parent_id = t.id
    )
    SELECT wba.id, wba.bin_id, wba.allocated_quantity,
           COALESCE(wba.reserved_quantity, 0) AS reserved_quantity,
           wb.location_id AS bin_location_id
    FROM warehouse_bin_allocations wba
    JOIN warehouse_bins wb ON wb.id = wba.bin_id
    WHERE wba.warehouse_item_id = p_item_id
      AND wb.location_id IN (SELECT id FROM loc_tree)
      AND (p_bin_allocation_id IS NULL OR wba.id = p_bin_allocation_id)
      AND wba.allocated_quantity > 0
    ORDER BY
      CASE WHEN p_bin_allocation_id IS NOT NULL AND wba.id = p_bin_allocation_id THEN 0 ELSE 1 END,
      wba.created_at ASC
    FOR UPDATE OF wba
  LOOP
    EXIT WHEN v_remaining <= 0;

    v_take := LEAST(v_alloc.allocated_quantity, v_remaining);
    IF v_take <= 0 THEN CONTINUE; END IF;

    v_before := v_alloc.allocated_quantity;
    v_bin_id := v_alloc.bin_id;
    v_bin_loc := v_alloc.bin_location_id;

    INSERT INTO warehouse_stock_movements (
      warehouse_item_id, bin_allocation_id, movement_type,
      reference_type, reference_id, reference_number,
      quantity_change, quantity_before, quantity_after,
      notes, created_by, created_at
    ) VALUES (
      p_item_id, v_alloc.id, 'issue',
      'material_issue', p_min_id, p_min_number,
      -v_take, v_before, v_before - v_take,
      'Material issued via MIN: ' || COALESCE(p_min_number, 'Unknown'),
      auth.uid(), NOW()
    );

    INSERT INTO stock_transactions (
      item_id, location_id, bin_id,
      transaction_type, reference_type, reference_id,
      quantity_change,
      notes, company_id, created_by
    ) VALUES (
      p_item_id, v_bin_loc, v_bin_id,
      'material_issue', 'manual', p_min_id,
      -v_take,
      'Material Issue: ' || COALESCE(p_min_number, p_min_id::text, 'MIN'),
      v_company_id, auth.uid()
    );

    UPDATE warehouse_bin_allocations
    SET allocated_quantity = GREATEST(0, allocated_quantity - v_take),
        reserved_quantity  = GREATEST(0, COALESCE(reserved_quantity, 0) - LEAST(v_take, COALESCE(reserved_quantity, 0))),
        updated_at = NOW()
    WHERE id = v_alloc.id;

    v_remaining := v_remaining - v_take;
  END LOOP;

  IF v_remaining > 0 THEN
    RAISE EXCEPTION 'Could not allocate full quantity at location subtree. Short by %', v_remaining;
  END IF;

  UPDATE warehouse_items
  SET reserved_quantity = GREATEST(0, COALESCE(reserved_quantity, 0) - p_quantity_issued),
      updated_at = NOW()
  WHERE id = p_item_id;
END;
$function$;

-- =========================================================
-- 2. Hierarchy-aware overload (7 args, with secondary)
-- =========================================================
CREATE OR REPLACE FUNCTION public.process_material_issue_stock_update(
  p_item_id uuid,
  p_quantity_issued numeric,
  p_location_id uuid,
  p_bin_allocation_id uuid DEFAULT NULL::uuid,
  p_min_id uuid DEFAULT NULL::uuid,
  p_min_number text DEFAULT NULL::text,
  p_secondary_quantity_issued numeric DEFAULT NULL::numeric
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_item RECORD;
  v_alloc RECORD;
  v_available numeric := 0;
  v_sec_available numeric := 0;
  v_remaining numeric := p_quantity_issued;
  v_sec_remaining numeric := COALESCE(p_secondary_quantity_issued, 0);
  v_take numeric;
  v_sec_take numeric;
  v_before numeric;
  v_company_id uuid;
  v_bin_id uuid;
  v_bin_loc uuid;
  v_track_sec boolean := false;
  v_sec_uom text;
BEGIN
  IF p_location_id IS NULL THEN
    RAISE EXCEPTION 'Location is required for material issue';
  END IF;
  IF p_quantity_issued IS NULL OR p_quantity_issued <= 0 THEN
    RAISE EXCEPTION 'Quantity issued must be positive';
  END IF;

  IF p_min_id IS NOT NULL THEN
    SELECT company_id INTO v_company_id FROM material_issue_notes WHERE id = p_min_id;
  END IF;

  SELECT * INTO v_item FROM warehouse_items WHERE id = p_item_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Warehouse item not found: %', p_item_id;
  END IF;

  v_track_sec := COALESCE(v_item.track_secondary_quantity, false);
  v_sec_uom := v_item.secondary_uom;
  IF NOT v_track_sec THEN v_sec_remaining := 0; END IF;

  WITH RECURSIVE loc_tree AS (
    SELECT id FROM warehouse_locations WHERE id = p_location_id
    UNION ALL
    SELECT wl.id FROM warehouse_locations wl JOIN loc_tree t ON wl.parent_id = t.id
  )
  SELECT
    COALESCE(SUM(GREATEST(0, wba.allocated_quantity - COALESCE(wba.reserved_quantity, 0))), 0),
    COALESCE(SUM(COALESCE(wba.secondary_quantity, 0)), 0)
    INTO v_available, v_sec_available
  FROM warehouse_bin_allocations wba
  JOIN warehouse_bins wb ON wb.id = wba.bin_id
  WHERE wba.warehouse_item_id = p_item_id
    AND wb.location_id IN (SELECT id FROM loc_tree);

  IF v_available < p_quantity_issued THEN
    RAISE EXCEPTION 'Insufficient stock at selected location (incl. sub-locations). Available: %, Requested: %',
      v_available, p_quantity_issued;
  END IF;
  IF v_track_sec AND v_sec_remaining > 0 AND v_sec_available < v_sec_remaining THEN
    RAISE EXCEPTION 'Insufficient secondary stock at location subtree. Available: %, Requested: %',
      v_sec_available, v_sec_remaining;
  END IF;

  IF p_bin_allocation_id IS NOT NULL THEN
    PERFORM 1
    FROM warehouse_bin_allocations wba
    JOIN warehouse_bins wb ON wb.id = wba.bin_id
    WHERE wba.id = p_bin_allocation_id
      AND wba.warehouse_item_id = p_item_id
      AND wb.location_id IN (
        WITH RECURSIVE lt AS (
          SELECT id FROM warehouse_locations WHERE id = p_location_id
          UNION ALL
          SELECT wl.id FROM warehouse_locations wl JOIN lt t2 ON wl.parent_id = t2.id
        ) SELECT id FROM lt
      );
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Selected bin does not belong to the issue location subtree';
    END IF;
  END IF;

  FOR v_alloc IN
    WITH RECURSIVE loc_tree AS (
      SELECT id FROM warehouse_locations WHERE id = p_location_id
      UNION ALL
      SELECT wl.id FROM warehouse_locations wl JOIN loc_tree t ON wl.parent_id = t.id
    )
    SELECT wba.id, wba.bin_id, wba.allocated_quantity,
           COALESCE(wba.reserved_quantity, 0) AS reserved_quantity,
           COALESCE(wba.secondary_quantity, 0) AS secondary_quantity,
           wb.location_id AS bin_location_id
    FROM warehouse_bin_allocations wba
    JOIN warehouse_bins wb ON wb.id = wba.bin_id
    WHERE wba.warehouse_item_id = p_item_id
      AND wb.location_id IN (SELECT id FROM loc_tree)
      AND (p_bin_allocation_id IS NULL OR wba.id = p_bin_allocation_id)
      AND wba.allocated_quantity > 0
    ORDER BY
      CASE WHEN p_bin_allocation_id IS NOT NULL AND wba.id = p_bin_allocation_id THEN 0 ELSE 1 END,
      wba.created_at ASC
    FOR UPDATE OF wba
  LOOP
    EXIT WHEN v_remaining <= 0;
    v_take := LEAST(v_alloc.allocated_quantity, v_remaining);
    IF v_take <= 0 THEN CONTINUE; END IF;

    v_before := v_alloc.allocated_quantity;
    v_bin_id := v_alloc.bin_id;
    v_bin_loc := v_alloc.bin_location_id;

    IF v_track_sec AND v_sec_remaining > 0 THEN
      IF v_take >= v_remaining THEN
        v_sec_take := LEAST(v_sec_remaining, v_alloc.secondary_quantity);
      ELSE
        v_sec_take := ROUND(COALESCE(p_secondary_quantity_issued,0) * (v_take / p_quantity_issued), 4);
        v_sec_take := LEAST(v_sec_take, v_alloc.secondary_quantity, v_sec_remaining);
      END IF;
    ELSE
      v_sec_take := 0;
    END IF;

    INSERT INTO warehouse_stock_movements (
      warehouse_item_id, bin_allocation_id, movement_type,
      reference_type, reference_id, reference_number,
      quantity_change, quantity_before, quantity_after,
      notes, created_by, created_at
    ) VALUES (
      p_item_id, v_alloc.id, 'issue',
      'material_issue', p_min_id, p_min_number,
      -v_take, v_before, v_before - v_take,
      'Material issued via MIN: ' || COALESCE(p_min_number, 'Unknown'),
      auth.uid(), NOW()
    );

    INSERT INTO stock_transactions (
      item_id, location_id, bin_id,
      transaction_type, reference_type, reference_id,
      quantity_change,
      secondary_quantity_change, secondary_uom,
      notes, company_id, created_by
    ) VALUES (
      p_item_id, v_bin_loc, v_bin_id,
      'material_issue', 'manual', p_min_id,
      -v_take,
      CASE WHEN v_track_sec AND v_sec_take > 0 THEN -v_sec_take ELSE NULL END,
      CASE WHEN v_track_sec THEN v_sec_uom ELSE NULL END,
      'Material Issue: ' || COALESCE(p_min_number, p_min_id::text, 'MIN'),
      v_company_id, auth.uid()
    );

    UPDATE warehouse_bin_allocations
    SET allocated_quantity = GREATEST(0, allocated_quantity - v_take),
        reserved_quantity  = GREATEST(0, COALESCE(reserved_quantity, 0) - LEAST(v_take, COALESCE(reserved_quantity, 0))),
        secondary_quantity = CASE
          WHEN v_track_sec THEN GREATEST(0, COALESCE(secondary_quantity, 0) - v_sec_take)
          ELSE secondary_quantity
        END,
        updated_at = NOW()
    WHERE id = v_alloc.id;

    v_remaining := v_remaining - v_take;
    v_sec_remaining := v_sec_remaining - v_sec_take;
  END LOOP;

  IF v_remaining > 0 THEN
    RAISE EXCEPTION 'Could not allocate full quantity at location subtree. Short by %', v_remaining;
  END IF;

  UPDATE warehouse_items
  SET reserved_quantity = GREATEST(0, COALESCE(reserved_quantity, 0) - p_quantity_issued),
      updated_at = NOW()
  WHERE id = p_item_id;
END;
$function$;

-- =========================================================
-- 3. Reconciliation log table
-- =========================================================
CREATE TABLE IF NOT EXISTS public.material_issue_reconciliation_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  min_id uuid NOT NULL,
  min_number text,
  item_id uuid NOT NULL,
  quantity_issued numeric NOT NULL,
  reason text NOT NULL,
  company_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.material_issue_reconciliation_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins view reconciliation log" ON public.material_issue_reconciliation_log;
CREATE POLICY "Admins view reconciliation log"
ON public.material_issue_reconciliation_log
FOR SELECT TO authenticated
USING (
  public.has_role(auth.uid(), 'super_admin'::app_role)
  OR public.has_role(auth.uid(), 'admin'::app_role)
);

-- =========================================================
-- 4. Replay deduction for already-completed MIN lines that
--    never produced a stock_transactions row
-- =========================================================
DO $replay$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT mii.id AS item_row_id,
           mii.item_id,
           mii.quantity_issued,
           mii.secondary_quantity_issued,
           min.id AS min_id,
           min.min_number,
           min.location_id,
           min.company_id
    FROM material_issue_items mii
    JOIN material_issue_notes min ON min.id = mii.min_id
    WHERE min.status IN ('completed','issued')
      AND min.location_id IS NOT NULL
      AND mii.quantity_issued > 0
      AND NOT EXISTS (
        SELECT 1 FROM stock_transactions st
        WHERE st.reference_id = min.id
          AND st.item_id = mii.item_id
          AND st.transaction_type = 'material_issue'
      )
    ORDER BY min.created_at
  LOOP
    BEGIN
      PERFORM public.process_material_issue_stock_update(
        r.item_id, r.quantity_issued, r.location_id,
        NULL, r.min_id, r.min_number, r.secondary_quantity_issued
      );
    EXCEPTION WHEN OTHERS THEN
      INSERT INTO public.material_issue_reconciliation_log
        (min_id, min_number, item_id, quantity_issued, reason, company_id)
      VALUES (r.min_id, r.min_number, r.item_id, r.quantity_issued, SQLERRM, r.company_id);
    END;
  END LOOP;
END;
$replay$;
