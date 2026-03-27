
-- Step 1: Consolidate duplicate warehouse_bin_allocations rows
WITH dupes AS (
  SELECT warehouse_item_id, bin_id, company_id,
    MIN(id::text)::uuid as keep_id,
    SUM(allocated_quantity) as total_alloc,
    SUM(COALESCE(reserved_quantity, 0)) as total_reserved
  FROM warehouse_bin_allocations
  GROUP BY warehouse_item_id, bin_id, company_id
  HAVING COUNT(*) > 1
)
UPDATE warehouse_bin_allocations wba
SET allocated_quantity = d.total_alloc,
    reserved_quantity = d.total_reserved,
    updated_at = now()
FROM dupes d
WHERE wba.id = d.keep_id;

-- Delete the non-kept duplicates
DELETE FROM warehouse_bin_allocations
WHERE id NOT IN (
  SELECT MIN(id::text)::uuid FROM warehouse_bin_allocations
  GROUP BY warehouse_item_id, bin_id, company_id
);

-- Add unique constraint to prevent future duplicates
ALTER TABLE warehouse_bin_allocations
  ADD CONSTRAINT unique_item_bin_company
  UNIQUE (warehouse_item_id, bin_id, company_id);

-- Step 2: Create transfer_stock_fifo RPC
CREATE OR REPLACE FUNCTION public.transfer_stock_fifo(
  p_item_id UUID,
  p_from_bin_id UUID,
  p_to_bin_id UUID,
  p_quantity NUMERIC,
  p_company_id UUID,
  p_user_id UUID,
  p_transfer_number TEXT DEFAULT NULL,
  p_transfer_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_source_alloc RECORD;
  v_batch RECORD;
  v_remaining NUMERIC := p_quantity;
  v_batch_deduct NUMERIC;
  v_batch_details JSONB := '[]'::JSONB;
  v_current_stock NUMERIC;
BEGIN
  IF p_quantity <= 0 THEN
    RAISE EXCEPTION 'Transfer quantity must be positive';
  END IF;

  IF p_from_bin_id = p_to_bin_id THEN
    RAISE EXCEPTION 'Source and destination bins must be different';
  END IF;

  -- Lock and check source bin allocation
  SELECT * INTO v_source_alloc
  FROM warehouse_bin_allocations
  WHERE warehouse_item_id = p_item_id
    AND bin_id = p_from_bin_id
    AND company_id = p_company_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'No stock allocation found for this item at the source bin';
  END IF;

  IF COALESCE(v_source_alloc.allocated_quantity, 0) - COALESCE(v_source_alloc.reserved_quantity, 0) < p_quantity THEN
    RAISE EXCEPTION 'Insufficient available stock at source bin. Available: %, Requested: %',
      COALESCE(v_source_alloc.allocated_quantity, 0) - COALESCE(v_source_alloc.reserved_quantity, 0),
      p_quantity;
  END IF;

  -- FIFO: track batch involvement for audit (bin transfer doesn't consume batches)
  FOR v_batch IN
    SELECT id, batch_number, quantity_remaining, expiry_date, manufacturing_date
    FROM item_batches
    WHERE warehouse_item_id = p_item_id
      AND status = 'active'
      AND quantity_remaining > 0
    ORDER BY expiry_date ASC NULLS LAST, manufacturing_date ASC NULLS LAST, created_at ASC
    FOR UPDATE
  LOOP
    EXIT WHEN v_remaining <= 0;

    v_batch_deduct := LEAST(v_remaining, v_batch.quantity_remaining);

    v_batch_details := v_batch_details || jsonb_build_object(
      'batch_id', v_batch.id,
      'batch_number', v_batch.batch_number,
      'quantity', v_batch_deduct,
      'expiry_date', v_batch.expiry_date
    );

    -- Upsert batch_stock_allocations for destination bin
    INSERT INTO batch_stock_allocations (batch_id, bin_id, allocated_quantity, company_id)
    VALUES (v_batch.id, p_to_bin_id, v_batch_deduct, p_company_id)
    ON CONFLICT (batch_id, bin_id) DO UPDATE
    SET allocated_quantity = batch_stock_allocations.allocated_quantity + EXCLUDED.allocated_quantity,
        updated_at = now();

    -- Deduct from source batch_stock_allocations if exists
    UPDATE batch_stock_allocations
    SET allocated_quantity = GREATEST(0, allocated_quantity - v_batch_deduct),
        updated_at = now()
    WHERE batch_id = v_batch.id
      AND bin_id = p_from_bin_id;

    v_remaining := v_remaining - v_batch_deduct;
  END LOOP;

  -- Deduct from source bin allocation
  UPDATE warehouse_bin_allocations
  SET allocated_quantity = GREATEST(0, allocated_quantity - p_quantity),
      updated_at = now()
  WHERE id = v_source_alloc.id;

  -- Upsert destination bin allocation
  INSERT INTO warehouse_bin_allocations (warehouse_item_id, bin_id, allocated_quantity, company_id, created_by)
  VALUES (p_item_id, p_to_bin_id, p_quantity, p_company_id, p_user_id)
  ON CONFLICT (warehouse_item_id, bin_id, company_id) DO UPDATE
  SET allocated_quantity = warehouse_bin_allocations.allocated_quantity + EXCLUDED.allocated_quantity,
      updated_at = now();

  -- Update source bin current_quantity
  UPDATE warehouse_bins
  SET current_quantity = GREATEST(0, COALESCE(current_quantity, 0) - p_quantity)
  WHERE id = p_from_bin_id;

  -- Update destination bin current_quantity
  UPDATE warehouse_bins
  SET current_quantity = COALESCE(current_quantity, 0) + p_quantity
  WHERE id = p_to_bin_id;

  -- Get current warehouse item stock for transaction records
  SELECT current_stock INTO v_current_stock
  FROM warehouse_items
  WHERE id = p_item_id;

  -- Log stock transactions (transfer doesn't change total stock)
  INSERT INTO stock_transactions (item_id, transaction_type, reference_type, reference_id,
    quantity_change, quantity_before, quantity_after, notes, company_id, created_by)
  VALUES
    (p_item_id, 'transfer_out', 'transfer', p_transfer_id,
     -p_quantity, v_current_stock, v_current_stock,
     format('Transfer %s - FIFO out from bin', COALESCE(p_transfer_number, '')),
     p_company_id, p_user_id),
    (p_item_id, 'transfer_in', 'transfer', p_transfer_id,
     p_quantity, v_current_stock, v_current_stock,
     format('Transfer %s - FIFO in to bin', COALESCE(p_transfer_number, '')),
     p_company_id, p_user_id);

  RETURN jsonb_build_object(
    'success', true,
    'quantity_transferred', p_quantity,
    'batch_details', v_batch_details
  );
END;
$$;
