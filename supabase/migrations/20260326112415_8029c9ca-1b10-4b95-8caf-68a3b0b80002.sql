
CREATE OR REPLACE FUNCTION public.process_fifo_batch_issue(
  p_issue_item_id UUID,
  p_item_id UUID,
  p_quantity_issued NUMERIC,
  p_company_id UUID
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_remaining NUMERIC := p_quantity_issued;
  v_take NUMERIC;
  v_batch RECORD;
  v_total_available NUMERIC;
BEGIN
  -- Check total available across active batches
  SELECT COALESCE(SUM(quantity_remaining), 0)
  INTO v_total_available
  FROM item_batches
  WHERE warehouse_item_id = p_item_id
    AND company_id = p_company_id
    AND status = 'active'
    AND quantity_remaining > 0;

  IF v_total_available < p_quantity_issued THEN
    RAISE EXCEPTION 'Insufficient batch stock for item %. Available: %, Requested: %',
      p_item_id, v_total_available, p_quantity_issued;
  END IF;

  -- FIFO: consume from oldest batches first
  FOR v_batch IN
    SELECT id, batch_number, quantity_remaining
    FROM item_batches
    WHERE warehouse_item_id = p_item_id
      AND company_id = p_company_id
      AND status = 'active'
      AND quantity_remaining > 0
    ORDER BY created_at ASC
    FOR UPDATE
  LOOP
    EXIT WHEN v_remaining <= 0;

    v_take := LEAST(v_batch.quantity_remaining, v_remaining);

    -- Deduct from batch
    UPDATE item_batches
    SET quantity_remaining = quantity_remaining - v_take,
        updated_at = now()
    WHERE id = v_batch.id;

    -- Record batch issue detail
    INSERT INTO batch_issue_details (issue_item_id, batch_id, quantity_from_batch)
    VALUES (p_issue_item_id, v_batch.id, v_take);

    v_remaining := v_remaining - v_take;
  END LOOP;

  -- Mark the issue item as FIFO allocated
  UPDATE material_issue_items
  SET batch_allocation_mode = 'fifo'
  WHERE id = p_issue_item_id;
END;
$$;
