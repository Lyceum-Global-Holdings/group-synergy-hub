
-- 1. Price history table
CREATE TABLE public.warehouse_item_price_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  catalog_item_id uuid REFERENCES public.warehouse_item_catalog(id) ON DELETE CASCADE,
  warehouse_item_id uuid REFERENCES public.warehouse_items(id) ON DELETE SET NULL,
  company_id uuid REFERENCES public.companies(id) ON DELETE CASCADE,
  grn_id uuid REFERENCES public.goods_receipt_notes(id) ON DELETE CASCADE,
  grn_item_id uuid UNIQUE REFERENCES public.grn_items(id) ON DELETE CASCADE,
  grn_number text,
  grn_date date,
  po_id uuid,
  po_number text,
  supplier_id uuid,
  supplier_name text,
  unit_price numeric NOT NULL DEFAULT 0,
  quantity_received numeric NOT NULL DEFAULT 0,
  total_cost numeric NOT NULL DEFAULT 0,
  currency text,
  received_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.warehouse_item_price_history TO authenticated;
GRANT ALL ON public.warehouse_item_price_history TO service_role;

ALTER TABLE public.warehouse_item_price_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read price history"
  ON public.warehouse_item_price_history
  FOR SELECT TO authenticated
  USING (auth.uid() IS NOT NULL);

CREATE INDEX idx_wiph_catalog_received ON public.warehouse_item_price_history(catalog_item_id, received_at DESC);
CREATE INDEX idx_wiph_warehouse_received ON public.warehouse_item_price_history(warehouse_item_id, received_at DESC);
CREATE INDEX idx_wiph_company_received ON public.warehouse_item_price_history(company_id, received_at DESC);

-- 2. Trigger function
CREATE OR REPLACE FUNCTION public.sync_item_price_on_grn_approval()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_item RECORD;
BEGIN
  IF NEW.status NOT IN ('approved','completed') THEN
    RETURN NEW;
  END IF;
  IF OLD.status = NEW.status THEN
    RETURN NEW;
  END IF;

  FOR v_item IN
    SELECT gi.*
    FROM public.grn_items gi
    WHERE gi.grn_id = NEW.id
      AND COALESCE(gi.quality_status, 'good') <> 'rejected'
      AND COALESCE(gi.quantity_received, 0) > 0
  LOOP
    -- Insert history (idempotent via unique grn_item_id)
    INSERT INTO public.warehouse_item_price_history (
      catalog_item_id, warehouse_item_id, company_id,
      grn_id, grn_item_id, grn_number, grn_date,
      po_id, po_number,
      supplier_id, supplier_name,
      unit_price, quantity_received, total_cost,
      received_at, created_by
    ) VALUES (
      v_item.catalog_item_id, v_item.warehouse_item_id, NEW.company_id,
      NEW.id, v_item.id, NEW.grn_number, NEW.grn_date,
      NEW.po_id, NEW.po_number,
      NEW.supplier_id, NEW.supplier_name,
      COALESCE(v_item.unit_price, 0),
      COALESCE(v_item.quantity_received, 0),
      COALESCE(v_item.total_cost, COALESCE(v_item.unit_price,0) * COALESCE(v_item.quantity_received,0)),
      COALESCE(NEW.approved_date, now()),
      NEW.approved_by
    )
    ON CONFLICT (grn_item_id) DO NOTHING;

    -- Update master catalog last price
    IF v_item.catalog_item_id IS NOT NULL AND COALESCE(v_item.unit_price,0) > 0 THEN
      UPDATE public.warehouse_item_catalog
        SET unit_cost = v_item.unit_price, updated_at = now()
        WHERE id = v_item.catalog_item_id;
    END IF;

    -- Update per-company inventory last cost
    IF v_item.catalog_item_id IS NOT NULL AND NEW.company_id IS NOT NULL AND COALESCE(v_item.unit_price,0) > 0 THEN
      UPDATE public.warehouse_items
        SET unit_cost = v_item.unit_price, updated_at = now()
        WHERE catalog_item_id = v_item.catalog_item_id
          AND company_id = NEW.company_id;
    END IF;
  END LOOP;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_item_price_on_grn_approval ON public.goods_receipt_notes;
CREATE TRIGGER trg_sync_item_price_on_grn_approval
  AFTER UPDATE OF status ON public.goods_receipt_notes
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_item_price_on_grn_approval();

-- 3. Backfill history from existing approved/completed GRNs
INSERT INTO public.warehouse_item_price_history (
  catalog_item_id, warehouse_item_id, company_id,
  grn_id, grn_item_id, grn_number, grn_date,
  po_id, po_number, supplier_id, supplier_name,
  unit_price, quantity_received, total_cost,
  received_at, created_by
)
SELECT
  gi.catalog_item_id, gi.warehouse_item_id, grn.company_id,
  grn.id, gi.id, grn.grn_number, grn.grn_date,
  grn.po_id, grn.po_number, grn.supplier_id, grn.supplier_name,
  COALESCE(gi.unit_price,0), COALESCE(gi.quantity_received,0),
  COALESCE(gi.total_cost, COALESCE(gi.unit_price,0)*COALESCE(gi.quantity_received,0)),
  COALESCE(grn.approved_date, grn.updated_at, grn.created_at),
  grn.approved_by
FROM public.grn_items gi
JOIN public.goods_receipt_notes grn ON grn.id = gi.grn_id
WHERE grn.status IN ('approved','completed')
  AND COALESCE(gi.quality_status,'good') <> 'rejected'
  AND COALESCE(gi.quantity_received,0) > 0
ON CONFLICT (grn_item_id) DO NOTHING;

-- 4. Refresh last price on catalog from most recent history row
WITH latest AS (
  SELECT DISTINCT ON (catalog_item_id)
    catalog_item_id, unit_price
  FROM public.warehouse_item_price_history
  WHERE catalog_item_id IS NOT NULL AND unit_price > 0
  ORDER BY catalog_item_id, received_at DESC
)
UPDATE public.warehouse_item_catalog c
  SET unit_cost = l.unit_price, updated_at = now()
FROM latest l
WHERE c.id = l.catalog_item_id;

-- 5. Refresh per-company inventory last cost
WITH latest AS (
  SELECT DISTINCT ON (catalog_item_id, company_id)
    catalog_item_id, company_id, unit_price
  FROM public.warehouse_item_price_history
  WHERE catalog_item_id IS NOT NULL AND company_id IS NOT NULL AND unit_price > 0
  ORDER BY catalog_item_id, company_id, received_at DESC
)
UPDATE public.warehouse_items wi
  SET unit_cost = l.unit_price, updated_at = now()
FROM latest l
WHERE wi.catalog_item_id = l.catalog_item_id
  AND wi.company_id = l.company_id;
