
-- 1. Add bin_id to batch_issue_details for audit traceability
ALTER TABLE public.batch_issue_details
  ADD COLUMN IF NOT EXISTS bin_id uuid NULL REFERENCES public.warehouse_bins(id);

-- 2. Drop old FIFO function (4-arg) and recreate with location scope
DROP FUNCTION IF EXISTS public.process_fifo_batch_issue(uuid, uuid, numeric, uuid);

CREATE OR REPLACE FUNCTION public.process_fifo_batch_issue(
  p_issue_item_id uuid,
  p_item_id       uuid,
  p_quantity_issued numeric,
  p_company_id    uuid,
  p_location_id   uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_remaining numeric := p_quantity_issued;
  v_take numeric;
  v_alloc record;
  v_available numeric;
BEGIN
  IF p_location_id IS NULL THEN
    RAISE EXCEPTION 'Location is required for FIFO batch issue (item %)', p_item_id;
  END IF;

  -- Availability scoped to the issue location (and its sub-locations)
  WITH RECURSIVE loc_tree AS (
    SELECT id FROM warehouse_locations WHERE id = p_location_id
    UNION ALL
    SELECT wl.id FROM warehouse_locations wl JOIN loc_tree t ON wl.parent_id = t.id
  )
  SELECT COALESCE(SUM(LEAST(bsa.allocated_quantity, ib.quantity_remaining)), 0)
    INTO v_available
  FROM batch_stock_allocations bsa
  JOIN item_batches ib  ON ib.id = bsa.batch_id
  JOIN warehouse_bins wb ON wb.id = bsa.bin_id
  WHERE ib.warehouse_item_id = p_item_id
    AND ib.company_id = p_company_id
    AND ib.status = 'active'
    AND ib.quantity_remaining > 0
    AND bsa.allocated_quantity > 0
    AND wb.location_id IN (SELECT id FROM loc_tree);

  IF v_available < p_quantity_issued THEN
    RAISE EXCEPTION 'Insufficient batch stock at issue location for item %. Available: %, Requested: %',
      p_item_id, v_available, p_quantity_issued;
  END IF;

  -- FIFO: consume oldest lots first, within the location tree
  FOR v_alloc IN
    WITH RECURSIVE loc_tree AS (
      SELECT id FROM warehouse_locations WHERE id = p_location_id
      UNION ALL
      SELECT wl.id FROM warehouse_locations wl JOIN loc_tree t ON wl.parent_id = t.id
    )
    SELECT bsa.id AS alloc_id,
           bsa.bin_id,
           bsa.allocated_quantity AS bin_qty,
           ib.id AS batch_id,
           ib.quantity_remaining AS batch_qty,
           ib.created_at AS batch_created_at,
           ib.expiry_date
      FROM batch_stock_allocations bsa
      JOIN item_batches ib  ON ib.id = bsa.batch_id
      JOIN warehouse_bins wb ON wb.id = bsa.bin_id
     WHERE ib.warehouse_item_id = p_item_id
       AND ib.company_id = p_company_id
       AND ib.status = 'active'
       AND ib.quantity_remaining > 0
       AND bsa.allocated_quantity > 0
       AND wb.location_id IN (SELECT id FROM loc_tree)
     ORDER BY ib.created_at ASC, ib.expiry_date NULLS LAST, bsa.created_at ASC
     FOR UPDATE OF bsa, ib
  LOOP
    EXIT WHEN v_remaining <= 0;

    v_take := LEAST(v_alloc.bin_qty, v_alloc.batch_qty, v_remaining);
    IF v_take <= 0 THEN CONTINUE; END IF;

    -- Deduct from this bin's allocation of the batch
    UPDATE batch_stock_allocations
       SET allocated_quantity = allocated_quantity - v_take,
           updated_at = now()
     WHERE id = v_alloc.alloc_id;

    -- Deduct from the batch master quantity; flip to depleted if exhausted
    UPDATE item_batches
       SET quantity_remaining = quantity_remaining - v_take,
           status = CASE WHEN quantity_remaining - v_take <= 0 THEN 'depleted' ELSE status END,
           updated_at = now()
     WHERE id = v_alloc.batch_id;

    INSERT INTO batch_issue_details (issue_item_id, batch_id, quantity_from_batch, bin_id)
    VALUES (p_issue_item_id, v_alloc.batch_id, v_take, v_alloc.bin_id);

    v_remaining := v_remaining - v_take;
  END LOOP;

  UPDATE material_issue_items
     SET batch_allocation_mode = 'fifo'
   WHERE id = p_issue_item_id;
END;
$function$;

-- 3. Backwards-compat shim: old 4-arg signature fails loudly
CREATE OR REPLACE FUNCTION public.process_fifo_batch_issue(
  p_issue_item_id uuid,
  p_item_id       uuid,
  p_quantity_issued numeric,
  p_company_id    uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  RAISE EXCEPTION 'process_fifo_batch_issue requires a location_id (call the 5-arg overload)';
END;
$function$;

-- 4. issue_material — scope availability check and pass location into FIFO
CREATE OR REPLACE FUNCTION public.issue_material(p_min_id uuid)
RETURNS material_issue_notes
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_min   public.material_issue_notes;
  v_uid   uuid := auth.uid();
  v_name  text;
  v_item  record;
  v_batch_avail numeric;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  IF NOT public.is_min_approver(v_uid) THEN
    RAISE EXCEPTION 'Only admins can post a physical Material Issue';
  END IF;

  SELECT * INTO v_min FROM public.material_issue_notes WHERE id = p_min_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Material Issue Note % not found', p_min_id;
  END IF;

  IF v_min.status <> 'approved' THEN
    RAISE EXCEPTION 'MIN % is not approved (current status: %); cannot post goods issue',
      v_min.min_number, v_min.status;
  END IF;

  IF v_min.location_id IS NULL THEN
    RAISE EXCEPTION 'MIN % has no issue location set; cannot deduct stock', v_min.min_number;
  END IF;

  SELECT COALESCE(p.full_name, u.email)
    INTO v_name
    FROM auth.users u
    LEFT JOIN public.profiles p ON p.id = u.id
   WHERE u.id = v_uid;

  FOR v_item IN
    SELECT id, item_id, quantity_issued, secondary_quantity_issued
      FROM public.material_issue_items
     WHERE min_id = p_min_id
     ORDER BY line_number
  LOOP
    IF v_item.quantity_issued IS NULL OR v_item.quantity_issued <= 0 THEN
      CONTINUE;
    END IF;

    -- Location-scoped availability of batched stock for this item
    WITH RECURSIVE loc_tree AS (
      SELECT id FROM public.warehouse_locations WHERE id = v_min.location_id
      UNION ALL
      SELECT wl.id FROM public.warehouse_locations wl JOIN loc_tree t ON wl.parent_id = t.id
    )
    SELECT COALESCE(SUM(LEAST(bsa.allocated_quantity, ib.quantity_remaining)), 0)
      INTO v_batch_avail
    FROM public.batch_stock_allocations bsa
    JOIN public.item_batches ib  ON ib.id = bsa.batch_id
    JOIN public.warehouse_bins wb ON wb.id = bsa.bin_id
    WHERE ib.warehouse_item_id = v_item.item_id
      AND ib.company_id = v_min.company_id
      AND ib.status = 'active'
      AND ib.quantity_remaining > 0
      AND bsa.allocated_quantity > 0
      AND wb.location_id IN (SELECT id FROM loc_tree);

    IF v_batch_avail > 0 THEN
      PERFORM public.process_fifo_batch_issue(
        p_issue_item_id => v_item.id,
        p_item_id       => v_item.item_id,
        p_quantity_issued => v_item.quantity_issued,
        p_company_id    => v_min.company_id,
        p_location_id   => v_min.location_id
      );
    END IF;

    PERFORM public.process_material_issue_stock_update(
      p_item_id                  => v_item.item_id,
      p_quantity_issued          => v_item.quantity_issued,
      p_location_id              => v_min.location_id,
      p_bin_allocation_id        => NULL,
      p_min_id                   => p_min_id,
      p_min_number               => v_min.min_number,
      p_secondary_quantity_issued => v_item.secondary_quantity_issued
    );

    UPDATE public.material_issue_items
       SET issued_at = now(),
           quantity_received = COALESCE(quantity_received, 0)
     WHERE id = v_item.id;
  END LOOP;

  UPDATE public.material_issue_notes
     SET status         = 'issued',
         issued_by      = v_uid,
         issued_by_name = v_name,
         updated_at     = now()
   WHERE id = p_min_id
  RETURNING * INTO v_min;

  RETURN v_min;
END;
$function$;

-- 5. RPC the dialog uses for the location-scoped FIFO preview
CREATE OR REPLACE FUNCTION public.preview_fifo_batch_issue(
  p_item_id     uuid,
  p_company_id  uuid,
  p_location_id uuid,
  p_quantity    numeric
)
RETURNS TABLE (
  batch_id          uuid,
  batch_number      text,
  bin_id            uuid,
  bin_code          text,
  location_id       uuid,
  location_name     text,
  bin_available     numeric,
  batch_available   numeric,
  available         numeric,
  take              numeric,
  expiry_date       date,
  batch_created_at  timestamptz
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_remaining numeric := COALESCE(p_quantity, 0);
BEGIN
  IF p_location_id IS NULL THEN
    RETURN;
  END IF;

  RETURN QUERY
  WITH RECURSIVE loc_tree AS (
    SELECT id FROM warehouse_locations WHERE id = p_location_id
    UNION ALL
    SELECT wl.id FROM warehouse_locations wl JOIN loc_tree t ON wl.parent_id = t.id
  ),
  ordered AS (
    SELECT ib.id            AS batch_id,
           ib.batch_number,
           wb.id             AS bin_id,
           wb.bin_code,
           wl.id             AS location_id,
           wl.name           AS location_name,
           bsa.allocated_quantity AS bin_available,
           ib.quantity_remaining  AS batch_available,
           LEAST(bsa.allocated_quantity, ib.quantity_remaining) AS available,
           ib.expiry_date,
           ib.created_at     AS batch_created_at,
           ROW_NUMBER() OVER (ORDER BY ib.created_at ASC, ib.expiry_date NULLS LAST, bsa.created_at ASC) AS rn
      FROM batch_stock_allocations bsa
      JOIN item_batches ib  ON ib.id = bsa.batch_id
      JOIN warehouse_bins wb ON wb.id = bsa.bin_id
      JOIN warehouse_locations wl ON wl.id = wb.location_id
     WHERE ib.warehouse_item_id = p_item_id
       AND ib.company_id = p_company_id
       AND ib.status = 'active'
       AND ib.quantity_remaining > 0
       AND bsa.allocated_quantity > 0
       AND wb.location_id IN (SELECT id FROM loc_tree)
  ),
  running AS (
    SELECT o.*,
           SUM(o.available) OVER (ORDER BY o.rn) AS cum
      FROM ordered o
  )
  SELECT r.batch_id, r.batch_number, r.bin_id, r.bin_code,
         r.location_id, r.location_name,
         r.bin_available, r.batch_available, r.available,
         LEAST(r.available,
               GREATEST(0, v_remaining - (r.cum - r.available))) AS take,
         r.expiry_date, r.batch_created_at
    FROM running r
   WHERE (r.cum - r.available) < v_remaining
   ORDER BY r.rn;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.preview_fifo_batch_issue(uuid, uuid, uuid, numeric) TO authenticated;
