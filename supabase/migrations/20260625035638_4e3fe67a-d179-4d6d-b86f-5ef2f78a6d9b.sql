
CREATE OR REPLACE FUNCTION public.ensure_opening_batch_for_bin_allocation(
  _allocation_id uuid
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  alloc            warehouse_bin_allocations%ROWTYPE;
  is_tracked       boolean;
  master_cost      numeric;
  batched_qty      numeric;
  delta            numeric;
  new_batch_id     uuid;
  lot_no           text;
  seq              integer;
  prefix           text;
BEGIN
  SELECT * INTO alloc FROM warehouse_bin_allocations WHERE id = _allocation_id;
  IF NOT FOUND THEN RETURN NULL; END IF;

  SELECT cat.is_batch_tracked,
         COALESCE(cat.unit_cost, wi.unit_cost, 0)
    INTO is_tracked, master_cost
  FROM warehouse_items wi
  JOIN warehouse_item_catalog cat ON cat.id = wi.catalog_item_id
  WHERE wi.id = alloc.warehouse_item_id;

  IF NOT COALESCE(is_tracked, false) THEN RETURN NULL; END IF;

  SELECT COALESCE(SUM(bsa.allocated_quantity), 0)
    INTO batched_qty
  FROM batch_stock_allocations bsa
  JOIN item_batches b ON b.id = bsa.batch_id
  WHERE bsa.bin_id = alloc.bin_id
    AND b.warehouse_item_id = alloc.warehouse_item_id
    AND COALESCE(b.company_id, alloc.company_id) = alloc.company_id;

  delta := COALESCE(alloc.allocated_quantity, 0) - batched_qty;
  IF delta <= 0 THEN RETURN NULL; END IF;

  -- Per-item-unique lot. Format: OPN-YYMMDD-NNNN  (15 chars, GS1 AI(10) safe)
  prefix := 'OPN-' || to_char(now(), 'YYMMDD') || '-';

  SELECT COALESCE(MAX(suffix), 0) + 1 INTO seq
  FROM (
    SELECT NULLIF(SUBSTRING(batch_number FROM '([0-9]+)$'), '')::int AS suffix
    FROM item_batches
    WHERE warehouse_item_id = alloc.warehouse_item_id
      AND COALESCE(company_id, alloc.company_id) = alloc.company_id
      AND batch_number LIKE prefix || '%'
  ) s;

  lot_no := prefix || LPAD(seq::text, 4, '0');

  INSERT INTO item_batches (
    warehouse_item_id, batch_number, quantity_received, quantity_remaining,
    unit_cost, status, company_id, notes
  ) VALUES (
    alloc.warehouse_item_id, lot_no, delta, delta,
    master_cost, 'active', alloc.company_id,
    'Auto-created opening lot — pre-existing stock reconciliation'
  )
  RETURNING id INTO new_batch_id;

  INSERT INTO batch_stock_allocations (batch_id, bin_id, allocated_quantity, company_id)
  VALUES (new_batch_id, alloc.bin_id, delta, alloc.company_id);

  RETURN new_batch_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.trg_ensure_opening_batch_on_allocation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.ensure_opening_batch_for_bin_allocation(NEW.id);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS ensure_opening_batch_on_allocation ON public.warehouse_bin_allocations;
CREATE TRIGGER ensure_opening_batch_on_allocation
AFTER INSERT OR UPDATE OF allocated_quantity
ON public.warehouse_bin_allocations
FOR EACH ROW
EXECUTE FUNCTION public.trg_ensure_opening_batch_on_allocation();

DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT a.id
    FROM warehouse_bin_allocations a
    JOIN warehouse_items wi ON wi.id = a.warehouse_item_id
    JOIN warehouse_item_catalog cat ON cat.id = wi.catalog_item_id
    WHERE cat.is_batch_tracked = true AND a.allocated_quantity > 0
  LOOP
    PERFORM public.ensure_opening_batch_for_bin_allocation(r.id);
  END LOOP;
END;
$$;
