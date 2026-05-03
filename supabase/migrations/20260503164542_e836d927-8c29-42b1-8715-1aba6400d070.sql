ALTER TABLE public.stock_transactions
  ADD COLUMN IF NOT EXISTS bin_id uuid NULL REFERENCES public.warehouse_bins(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_stock_transactions_item_loc_bin_created
  ON public.stock_transactions(item_id, location_id, bin_id, created_at DESC);

-- Backfill from notes pattern "Bin: <code>"
WITH parsed AS (
  SELECT
    st.id AS tx_id,
    st.location_id,
    trim(substring(st.notes FROM 'Bin:\s*([^\s,;|→\-]+)')) AS bin_code
  FROM public.stock_transactions st
  WHERE st.bin_id IS NULL
    AND st.notes ~* 'Bin:\s*'
), resolved AS (
  SELECT p.tx_id, MIN(b.id::text)::uuid AS bin_id
  FROM parsed p
  JOIN public.warehouse_bins b
    ON b.bin_code = p.bin_code
   AND (p.location_id IS NULL OR b.location_id = p.location_id)
  GROUP BY p.tx_id
  HAVING COUNT(*) = 1
)
UPDATE public.stock_transactions st
SET bin_id = r.bin_id
FROM resolved r
WHERE st.id = r.tx_id;

-- Auto-fill for single-bin items
WITH single_bin AS (
  SELECT a.warehouse_item_id, MIN(a.bin_id::text)::uuid AS bin_id
  FROM public.warehouse_bin_allocations a
  GROUP BY a.warehouse_item_id
  HAVING COUNT(DISTINCT a.bin_id) = 1
)
UPDATE public.stock_transactions st
SET bin_id = sb.bin_id
FROM single_bin sb
WHERE st.bin_id IS NULL
  AND st.item_id = sb.warehouse_item_id;

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
  v_single_bin uuid;
  v_bin_count int;
BEGIN
  SELECT location_id, company_id INTO v_loc, v_co
  FROM public.warehouse_items WHERE id = NEW.item_id;

  IF v_loc IS NOT NULL THEN NEW.location_id := v_loc; END IF;
  IF v_co  IS NOT NULL THEN NEW.company_id  := v_co;  END IF;

  IF NEW.bin_id IS NOT NULL THEN
    SELECT location_id INTO v_bin_loc FROM public.warehouse_bins WHERE id = NEW.bin_id;
    IF v_bin_loc IS DISTINCT FROM NEW.location_id THEN
      RAISE EXCEPTION 'bin_id % does not belong to location % (got %)', NEW.bin_id, NEW.location_id, v_bin_loc;
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

CREATE OR REPLACE VIEW public.v_stock_transactions_bin_mismatch AS
SELECT
  st.id              AS transaction_id,
  st.item_id,
  st.bin_id,
  st.location_id     AS transaction_location_id,
  b.location_id      AS bin_location_id,
  st.created_at
FROM public.stock_transactions st
JOIN public.warehouse_bins b ON b.id = st.bin_id
WHERE st.bin_id IS NOT NULL
  AND b.location_id IS DISTINCT FROM st.location_id;