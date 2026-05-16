-- Stage 6a: read-through view exposing warehouse_items + mirrored catalog fields.
-- Lets readers stay column-compatible after Phase 6b drops the mirrored columns.
-- Uses security_invoker so RLS on the base tables is honored.

DROP VIEW IF EXISTS public.warehouse_items_full;

CREATE VIEW public.warehouse_items_full
WITH (security_invoker = true)
AS
SELECT
  wi.id,
  wi.company_id,
  wi.catalog_item_id,
  wi.location_id,
  wi.current_stock,
  wi.reserved_quantity,
  wi.available_quantity,
  wi.base_uom,
  wi.secondary_uom,
  wi.track_secondary_quantity,
  wi.reorder_level,
  wi.min_stock_level,
  wi.max_stock_level,
  wi.unit_cost,
  wi.selling_price,
  wi.status,
  wi.notes,
  wi.created_at,
  wi.updated_at,
  -- mirrored-from-catalog fields (live join, always authoritative)
  COALESCE(c.item_code, wi.item_code)     AS item_code,
  COALESCE(c.name, wi.name)               AS name,
  COALESCE(c.description, wi.description) AS description,
  COALESCE(c.category_id, wi.category_id) AS category_id,
  COALESCE(c.unit_id, wi.unit_id)         AS unit_id,
  COALESCE(c.brand, wi.brand)             AS brand,
  COALESCE(c.manufacturer, wi.manufacturer) AS manufacturer,
  COALESCE(c.supplier_id, wi.supplier_id) AS supplier_id,
  COALESCE(c.barcode, wi.barcode)         AS barcode,
  COALESCE(c.sku, wi.sku)                 AS sku,
  COALESCE(c.image_url, wi.image_url)     AS image_url,
  COALESCE(c.is_serialized, wi.is_serialized)       AS is_serialized,
  COALESCE(c.is_batch_tracked, wi.is_batch_tracked) AS is_batch_tracked
FROM public.warehouse_items wi
LEFT JOIN public.warehouse_item_catalog c ON c.id = wi.catalog_item_id;

GRANT SELECT ON public.warehouse_items_full TO authenticated;
REVOKE ALL ON public.warehouse_items_full FROM anon, PUBLIC;