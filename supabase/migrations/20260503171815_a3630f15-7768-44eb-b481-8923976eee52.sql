-- 1. Drop legacy triggers that overwrote item total stock from a single transaction's quantity_after.
--    Bin-level quantities are no longer item totals, so these triggers would corrupt warehouse_items.current_stock.
DROP TRIGGER IF EXISTS update_item_stock_trigger ON public.stock_transactions;
DROP TRIGGER IF EXISTS update_stock_trigger ON public.stock_transactions;

-- warehouse_items.current_stock is kept in sync by trg_sync_item_stock_after_bin_allocation
-- which sums warehouse_bin_allocations.allocated_quantity per item. That trigger remains.

-- 2. Replace the location guard so the bin's physical location is canonical.
CREATE OR REPLACE FUNCTION public.stock_transactions_location_guard()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_co  uuid;
  v_bin_loc uuid;
  v_alloc_exists boolean;
  v_single_bin uuid;
  v_single_bin_loc uuid;
  v_bin_count int;
BEGIN
  -- Resolve company from the warehouse item; never trust caller-provided company.
  SELECT company_id INTO v_co
  FROM public.warehouse_items WHERE id = NEW.item_id;
  IF v_co IS NOT NULL THEN NEW.company_id := v_co; END IF;

  IF NEW.bin_id IS NOT NULL THEN
    -- Validate the bin is allocated to this item.
    SELECT EXISTS (
      SELECT 1 FROM public.warehouse_bin_allocations
      WHERE warehouse_item_id = NEW.item_id AND bin_id = NEW.bin_id
    ) INTO v_alloc_exists;

    IF NOT v_alloc_exists THEN
      RAISE EXCEPTION 'bin_id % is not allocated to item %', NEW.bin_id, NEW.item_id;
    END IF;

    -- Bin's physical location is authoritative for the transaction.
    SELECT location_id INTO v_bin_loc FROM public.warehouse_bins WHERE id = NEW.bin_id;
    IF v_bin_loc IS NOT NULL THEN
      NEW.location_id := v_bin_loc;
    END IF;
  ELSE
    -- No bin supplied: if the item has exactly one bin allocation, auto-fill it.
    SELECT COUNT(DISTINCT a.bin_id), MIN(a.bin_id::text)::uuid
      INTO v_bin_count, v_single_bin
    FROM public.warehouse_bin_allocations a
    WHERE a.warehouse_item_id = NEW.item_id;

    IF v_bin_count = 1 THEN
      NEW.bin_id := v_single_bin;
      SELECT location_id INTO v_single_bin_loc FROM public.warehouse_bins WHERE id = v_single_bin;
      IF v_single_bin_loc IS NOT NULL THEN
        NEW.location_id := v_single_bin_loc;
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

-- 3. Backfill: align stock_transactions.location_id with the bin's physical location.
UPDATE public.stock_transactions st
SET location_id = b.location_id
FROM public.warehouse_bins b
WHERE st.bin_id = b.id
  AND b.location_id IS NOT NULL
  AND st.location_id IS DISTINCT FROM b.location_id;

-- 4. Backfill missing bin_id from "Bin: <code>" notes when unambiguous for the item.
WITH parsed AS (
  SELECT
    st.id AS tx_id,
    st.item_id,
    trim(substring(st.notes FROM 'Bin:\s*([^\n,]+?)\s*$|Bin:\s*([^\n,]+?)\s*[\n,]')) AS bin_code_raw,
    trim(substring(st.notes FROM 'Bin:\s*([A-Za-z0-9_\-\. /]+)')) AS bin_code
  FROM public.stock_transactions st
  WHERE st.bin_id IS NULL
    AND st.notes ~* 'Bin:\s*'
), resolved AS (
  SELECT p.tx_id, MIN(b.id::text)::uuid AS bin_id, MIN(b.location_id::text)::uuid AS bin_loc
  FROM parsed p
  JOIN public.warehouse_bin_allocations a ON a.warehouse_item_id = p.item_id
  JOIN public.warehouse_bins b ON b.id = a.bin_id AND b.bin_code = p.bin_code
  GROUP BY p.tx_id
  HAVING COUNT(DISTINCT b.id) = 1
)
UPDATE public.stock_transactions st
SET bin_id = r.bin_id,
    location_id = COALESCE(r.bin_loc, st.location_id)
FROM resolved r
WHERE st.id = r.tx_id;

-- 5. Backfill: when an item has exactly one bin allocation, attach that bin to historical NULL-bin txs.
WITH single_bin_items AS (
  SELECT a.warehouse_item_id AS item_id,
         MIN(a.bin_id::text)::uuid AS bin_id
  FROM public.warehouse_bin_allocations a
  GROUP BY a.warehouse_item_id
  HAVING COUNT(DISTINCT a.bin_id) = 1
)
UPDATE public.stock_transactions st
SET bin_id = s.bin_id,
    location_id = COALESCE(b.location_id, st.location_id)
FROM single_bin_items s
JOIN public.warehouse_bins b ON b.id = s.bin_id
WHERE st.bin_id IS NULL
  AND st.item_id = s.item_id;

-- 6. Recompute per-bin running balances (quantity_before / quantity_after) for transactions that have a bin.
WITH ordered AS (
  SELECT st.id,
         st.item_id,
         st.bin_id,
         st.quantity_change,
         COALESCE(SUM(st.quantity_change) OVER (
           PARTITION BY st.item_id, st.bin_id
           ORDER BY st.created_at, st.id
           ROWS BETWEEN UNBOUNDED PRECEDING AND 1 PRECEDING
         ), 0) AS calc_before
  FROM public.stock_transactions st
  WHERE st.bin_id IS NOT NULL
)
UPDATE public.stock_transactions st
SET quantity_before = o.calc_before,
    quantity_after  = o.calc_before + o.quantity_change
FROM ordered o
WHERE st.id = o.id
  AND (st.quantity_before IS DISTINCT FROM o.calc_before
    OR st.quantity_after  IS DISTINCT FROM (o.calc_before + o.quantity_change));

-- 7. Re-sync warehouse_items.current_stock from bin allocations (so totals match reality).
UPDATE public.warehouse_items wi
SET current_stock = COALESCE(t.total, 0),
    updated_at = NOW()
FROM (
  SELECT warehouse_item_id, SUM(allocated_quantity) AS total
  FROM public.warehouse_bin_allocations
  GROUP BY warehouse_item_id
) t
WHERE wi.id = t.warehouse_item_id
  AND COALESCE(wi.current_stock, 0) IS DISTINCT FROM COALESCE(t.total, 0);

-- 8. Canonical reader: bin-scoped stock movement history with correct running balances.
CREATE OR REPLACE FUNCTION public.get_bin_scoped_stock_movements(
  p_item_id uuid,
  p_location_id uuid DEFAULT NULL,
  p_bin_id uuid DEFAULT NULL
)
RETURNS TABLE (
  id uuid,
  created_at timestamptz,
  transaction_type text,
  reference_type text,
  reference_id uuid,
  bin_id uuid,
  bin_code text,
  bin_name text,
  location_id uuid,
  location_code text,
  location_name text,
  quantity_change numeric,
  quantity_before numeric,
  quantity_after numeric,
  unit_cost numeric,
  total_value numeric,
  notes text,
  created_by uuid
)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  WITH base AS (
    SELECT st.*
    FROM public.stock_transactions st
    LEFT JOIN public.warehouse_bins b ON b.id = st.bin_id
    WHERE st.item_id = p_item_id
      AND (
        p_bin_id IS NOT NULL AND st.bin_id = p_bin_id
        OR p_bin_id IS NULL AND (
          p_location_id IS NULL
          OR b.location_id = p_location_id
          OR (st.bin_id IS NULL AND st.location_id = p_location_id)
        )
      )
  ), running AS (
    SELECT b.*,
           COALESCE(SUM(b.quantity_change) OVER (
             PARTITION BY b.item_id, b.bin_id
             ORDER BY b.created_at, b.id
             ROWS BETWEEN UNBOUNDED PRECEDING AND 1 PRECEDING
           ), 0) AS calc_before
    FROM base b
  )
  SELECT
    r.id,
    r.created_at,
    r.transaction_type::text,
    r.reference_type::text,
    r.reference_id,
    r.bin_id,
    wb.bin_code,
    wb.name AS bin_name,
    COALESCE(wb.location_id, r.location_id) AS location_id,
    wl.location_code,
    wl.name AS location_name,
    r.quantity_change,
    CASE WHEN r.bin_id IS NULL THEN r.quantity_before ELSE r.calc_before END AS quantity_before,
    CASE WHEN r.bin_id IS NULL THEN r.quantity_after  ELSE r.calc_before + r.quantity_change END AS quantity_after,
    r.unit_cost,
    r.total_value,
    r.notes,
    r.created_by
  FROM running r
  LEFT JOIN public.warehouse_bins wb ON wb.id = r.bin_id
  LEFT JOIN public.warehouse_locations wl ON wl.id = COALESCE(wb.location_id, r.location_id)
  ORDER BY r.created_at DESC, r.id DESC;
$$;

GRANT EXECUTE ON FUNCTION public.get_bin_scoped_stock_movements(uuid, uuid, uuid) TO authenticated;

-- 9. Diagnostic view: rows whose stored before/after differs from per-bin running balance.
CREATE OR REPLACE VIEW public.v_stock_transactions_balance_drift AS
WITH ordered AS (
  SELECT st.id, st.item_id, st.bin_id, st.created_at, st.quantity_change, st.quantity_before, st.quantity_after,
         COALESCE(SUM(st.quantity_change) OVER (
           PARTITION BY st.item_id, st.bin_id
           ORDER BY st.created_at, st.id
           ROWS BETWEEN UNBOUNDED PRECEDING AND 1 PRECEDING
         ), 0) AS calc_before
  FROM public.stock_transactions st
  WHERE st.bin_id IS NOT NULL
)
SELECT id, item_id, bin_id, created_at, quantity_change,
       quantity_before AS stored_before,
       quantity_after  AS stored_after,
       calc_before     AS computed_before,
       calc_before + quantity_change AS computed_after
FROM ordered
WHERE quantity_before IS DISTINCT FROM calc_before
   OR quantity_after  IS DISTINCT FROM (calc_before + quantity_change);
