-- Stage 1: Reconcile and lock the warehouse_items -> warehouse_item_catalog link.

-- 1a) For inventory rows that already have catalog_item_id but a drifted item_code,
--     sync the inventory item_code to match the catalog (catalog is the source of truth).
UPDATE public.warehouse_items wi
SET item_code = c.item_code
FROM public.warehouse_item_catalog c
WHERE wi.catalog_item_id = c.id
  AND wi.item_code IS DISTINCT FROM c.item_code;

-- 1b) Backfill catalog_item_id for rows that have NULL but whose item_code exists in catalog.
UPDATE public.warehouse_items wi
SET catalog_item_id = c.id
FROM public.warehouse_item_catalog c
WHERE wi.catalog_item_id IS NULL
  AND wi.item_code = c.item_code;

-- 1c) For true orphans (no catalog_item_id AND item_code not in catalog),
--     promote the inventory row into the global catalog and link.
WITH orphans AS (
  SELECT wi.id AS inv_id, wi.item_code, wi.name, wi.description, wi.category_id,
         wi.unit_id, wi.brand, wi.manufacturer, wi.supplier_id, wi.barcode, wi.sku,
         wi.unit_cost, wi.selling_price, wi.reorder_level, wi.min_stock_level,
         wi.max_stock_level, wi.image_url, wi.is_serialized, wi.is_batch_tracked,
         wi.status, wi.notes, wi.created_by
  FROM public.warehouse_items wi
  WHERE wi.catalog_item_id IS NULL
), inserted AS (
  INSERT INTO public.warehouse_item_catalog (
    item_code, name, description, category_id, unit_id, brand, manufacturer,
    supplier_id, barcode, sku, unit_cost, selling_price, reorder_level,
    min_stock_level, max_stock_level, image_url, is_serialized, is_batch_tracked,
    status, notes, created_by
  )
  SELECT item_code, name, description, category_id, unit_id, brand, manufacturer,
         supplier_id, barcode, sku, unit_cost, selling_price, reorder_level,
         min_stock_level, max_stock_level, image_url, is_serialized, is_batch_tracked,
         COALESCE(status, 'active'), notes, created_by
  FROM orphans
  RETURNING id, item_code
)
UPDATE public.warehouse_items wi
SET catalog_item_id = i.id
FROM inserted i
WHERE wi.item_code = i.item_code
  AND wi.catalog_item_id IS NULL;

-- 1d) Enforce contract: every inventory row must link to a catalog row.
ALTER TABLE public.warehouse_items
  ALTER COLUMN catalog_item_id SET NOT NULL;

-- 1e) Strengthen the FK: prevent catalog deletion while inventory references it.
ALTER TABLE public.warehouse_items
  DROP CONSTRAINT warehouse_items_catalog_item_id_fkey;
ALTER TABLE public.warehouse_items
  ADD CONSTRAINT warehouse_items_catalog_item_id_fkey
  FOREIGN KEY (catalog_item_id)
  REFERENCES public.warehouse_item_catalog(id)
  ON DELETE RESTRICT;

-- 1f) One company cannot stock the same catalog item twice.
ALTER TABLE public.warehouse_items
  ADD CONSTRAINT warehouse_items_company_catalog_unique
  UNIQUE (company_id, catalog_item_id);

-- 1g) Index for join performance (catalog -> inventory fan-out used in Stage 2 triggers).
CREATE INDEX IF NOT EXISTS idx_warehouse_items_catalog_item_id
  ON public.warehouse_items (catalog_item_id);