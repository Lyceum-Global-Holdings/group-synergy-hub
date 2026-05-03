-- 1. Add location_id column to stock_transactions (nullable for backfill)
ALTER TABLE public.stock_transactions
  ADD COLUMN IF NOT EXISTS location_id uuid NULL;

-- 2. Backfill location_id and company_id from the linked warehouse_items row
UPDATE public.stock_transactions st
SET location_id = wi.location_id
FROM public.warehouse_items wi
WHERE wi.id = st.item_id
  AND st.location_id IS NULL;

UPDATE public.stock_transactions st
SET company_id = wi.company_id
FROM public.warehouse_items wi
WHERE wi.id = st.item_id
  AND st.company_id IS NULL
  AND wi.company_id IS NOT NULL;

-- 3. Trigger: force location_id and company_id to follow the inventory row
CREATE OR REPLACE FUNCTION public.stock_transactions_location_guard()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_location_id uuid;
  v_company_id uuid;
BEGIN
  IF NEW.item_id IS NOT NULL THEN
    SELECT location_id, company_id
      INTO v_location_id, v_company_id
    FROM public.warehouse_items
    WHERE id = NEW.item_id;

    NEW.location_id := v_location_id;
    IF NEW.company_id IS NULL AND v_company_id IS NOT NULL THEN
      NEW.company_id := v_company_id;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_stock_transactions_location_guard ON public.stock_transactions;
CREATE TRIGGER trg_stock_transactions_location_guard
  BEFORE INSERT OR UPDATE OF item_id ON public.stock_transactions
  FOR EACH ROW
  EXECUTE FUNCTION public.stock_transactions_location_guard();

-- 4. Indexes for per-location history reads
CREATE INDEX IF NOT EXISTS idx_stock_tx_item_loc_created
  ON public.stock_transactions (item_id, location_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_stock_tx_company_loc_item_created
  ON public.stock_transactions (company_id, location_id, item_id, created_at DESC);

-- 5. Diagnostic view: rows whose stored location no longer matches the inventory row
CREATE OR REPLACE VIEW public.v_stock_transactions_location_mismatch AS
SELECT
  st.id                AS transaction_id,
  st.item_id,
  wi.item_code,
  st.location_id       AS tx_location_id,
  wi.location_id       AS item_location_id,
  st.company_id        AS tx_company_id,
  wi.company_id        AS item_company_id,
  st.transaction_type,
  st.created_at
FROM public.stock_transactions st
JOIN public.warehouse_items wi ON wi.id = st.item_id
WHERE st.location_id IS DISTINCT FROM wi.location_id
   OR st.company_id  IS DISTINCT FROM wi.company_id;

REVOKE ALL ON public.v_stock_transactions_location_mismatch FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.v_stock_transactions_location_mismatch TO service_role;