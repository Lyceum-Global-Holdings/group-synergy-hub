
-- Stage 3: revoke UPDATE on mirrored columns. Trigger already overwrites
-- them on the data layer; this rejects mutations at the API layer too.
REVOKE UPDATE (
  item_code, name, description, category_id, unit_id,
  brand, manufacturer, supplier_id, barcode, sku,
  image_url, is_serialized, is_batch_tracked
) ON public.warehouse_items FROM authenticated, anon;

-- Grant UPDATE on all per-company columns explicitly so PostgREST recognizes
-- them as writable (REVOKE above only removes mirrored ones).
GRANT UPDATE (
  current_stock, reserved_quantity, location_id,
  base_uom, secondary_uom, track_secondary_quantity,
  reorder_level, min_stock_level, max_stock_level,
  unit_cost, selling_price, status, notes,
  updated_at, catalog_item_id
) ON public.warehouse_items TO authenticated;
