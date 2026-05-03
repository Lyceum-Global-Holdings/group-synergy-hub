-- Allocation-aware backfill: prefer the bin that is actually allocated to this
-- warehouse_item, even if the bin's location_id differs from the transaction's.
WITH parsed AS (
  SELECT
    st.id AS tx_id,
    st.item_id,
    trim(substring(st.notes FROM 'Bin:\s*([A-Za-z0-9_\-\.]+)')) AS bin_code
  FROM public.stock_transactions st
  WHERE st.bin_id IS NULL
    AND st.notes ~* 'Bin:\s*'
), resolved AS (
  SELECT p.tx_id, MIN(b.id::text)::uuid AS bin_id
  FROM parsed p
  JOIN public.warehouse_bin_allocations a ON a.warehouse_item_id = p.item_id
  JOIN public.warehouse_bins b ON b.id = a.bin_id AND b.bin_code = p.bin_code
  GROUP BY p.tx_id
  HAVING COUNT(DISTINCT b.id) = 1
)
UPDATE public.stock_transactions st
SET bin_id = r.bin_id
FROM resolved r
WHERE st.id = r.tx_id;

-- Also relax the trigger: when supplied bin_id belongs to an allocation of the
-- same warehouse_item, accept it even if the bin's recorded location differs.
CREATE OR REPLACE FUNCTION public.stock_transactions_location_guard()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_loc uuid;
  v_co  uuid;
  v_bin_loc uuid;
  v_alloc_exists boolean;
  v_single_bin uuid;
  v_bin_count int;
BEGIN
  SELECT location_id, company_id INTO v_loc, v_co
  FROM public.warehouse_items WHERE id = NEW.item_id;

  IF v_loc IS NOT NULL THEN NEW.location_id := v_loc; END IF;
  IF v_co  IS NOT NULL THEN NEW.company_id  := v_co;  END IF;

  IF NEW.bin_id IS NOT NULL THEN
    SELECT location_id INTO v_bin_loc FROM public.warehouse_bins WHERE id = NEW.bin_id;
    SELECT EXISTS (
      SELECT 1 FROM public.warehouse_bin_allocations
      WHERE warehouse_item_id = NEW.item_id AND bin_id = NEW.bin_id
    ) INTO v_alloc_exists;
    IF NOT v_alloc_exists AND v_bin_loc IS DISTINCT FROM NEW.location_id THEN
      RAISE EXCEPTION 'bin_id % is not allocated to this item and does not belong to location %', NEW.bin_id, NEW.location_id;
    END IF;
  ELSE
    SELECT COUNT(DISTINCT a.bin_id), MIN(a.bin_id::text)::uuid
      INTO v_bin_count, v_single_bin
    FROM public.warehouse_bin_allocations a
    WHERE a.warehouse_item_id = NEW.item_id;
    IF v_bin_count = 1 THEN
      NEW.bin_id := v_single_bin;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;