-- Backfill: create catalog entries for orphaned warehouse_items (those with NULL catalog_item_id)
INSERT INTO warehouse_item_catalog (
  id, item_code, name, description, category_id, unit_id, location_id,
  brand, manufacturer, supplier_id, barcode, sku,
  unit_cost, selling_price, reorder_level, min_stock_level, max_stock_level,
  image_url, is_serialized, is_batch_tracked, status, notes,
  created_at, updated_at, created_by
)
SELECT
  gen_random_uuid(), wi.item_code, wi.name, wi.description, wi.category_id, wi.unit_id, wi.location_id,
  wi.brand, wi.manufacturer, wi.supplier_id, wi.barcode, wi.sku,
  wi.unit_cost, wi.selling_price, wi.reorder_level, wi.min_stock_level, wi.max_stock_level,
  wi.image_url, wi.is_serialized, wi.is_batch_tracked, wi.status, wi.notes,
  wi.created_at, wi.updated_at, wi.created_by
FROM warehouse_items wi
WHERE wi.catalog_item_id IS NULL
ON CONFLICT (item_code) DO NOTHING;

-- Now update the catalog_item_id on the orphaned warehouse_items
UPDATE warehouse_items wi
SET catalog_item_id = wic.id
FROM warehouse_item_catalog wic
WHERE wi.catalog_item_id IS NULL
  AND wi.item_code = wic.item_code;