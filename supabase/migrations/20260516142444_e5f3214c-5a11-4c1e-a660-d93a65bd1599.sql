
CREATE OR REPLACE FUNCTION public.reconcile_catalog_mirror()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  fixed_count integer;
BEGIN
  WITH upd AS (
    UPDATE public.warehouse_items wi
    SET
      item_code        = c.item_code,
      name             = c.name,
      description      = c.description,
      category_id      = c.category_id,
      unit_id          = c.unit_id,
      brand            = c.brand,
      manufacturer     = c.manufacturer,
      supplier_id      = c.supplier_id,
      barcode          = c.barcode,
      sku              = c.sku,
      image_url        = c.image_url,
      is_serialized    = c.is_serialized,
      is_batch_tracked = c.is_batch_tracked,
      updated_at       = now()
    FROM public.warehouse_item_catalog c
    WHERE wi.catalog_item_id = c.id
      AND (
           wi.item_code        IS DISTINCT FROM c.item_code
        OR wi.name             IS DISTINCT FROM c.name
        OR wi.description      IS DISTINCT FROM c.description
        OR wi.category_id      IS DISTINCT FROM c.category_id
        OR wi.unit_id          IS DISTINCT FROM c.unit_id
        OR wi.brand            IS DISTINCT FROM c.brand
        OR wi.manufacturer     IS DISTINCT FROM c.manufacturer
        OR wi.supplier_id      IS DISTINCT FROM c.supplier_id
        OR wi.barcode          IS DISTINCT FROM c.barcode
        OR wi.sku              IS DISTINCT FROM c.sku
        OR wi.image_url        IS DISTINCT FROM c.image_url
        OR wi.is_serialized    IS DISTINCT FROM c.is_serialized
        OR wi.is_batch_tracked IS DISTINCT FROM c.is_batch_tracked
      )
    RETURNING 1
  )
  SELECT count(*) INTO fixed_count FROM upd;
  RETURN fixed_count;
END;
$$;

REVOKE ALL ON FUNCTION public.reconcile_catalog_mirror() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.reconcile_catalog_mirror() TO authenticated;

CREATE OR REPLACE FUNCTION public.check_catalog_mirror_parity()
RETURNS TABLE (drift_count bigint, sample_inventory_id uuid)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH drifted AS (
    SELECT wi.id
    FROM public.warehouse_items wi
    JOIN public.warehouse_item_catalog c ON c.id = wi.catalog_item_id
    WHERE wi.item_code        IS DISTINCT FROM c.item_code
       OR wi.name             IS DISTINCT FROM c.name
       OR wi.category_id      IS DISTINCT FROM c.category_id
       OR wi.is_serialized    IS DISTINCT FROM c.is_serialized
       OR wi.is_batch_tracked IS DISTINCT FROM c.is_batch_tracked
       OR wi.barcode          IS DISTINCT FROM c.barcode
       OR wi.sku              IS DISTINCT FROM c.sku
       OR wi.brand            IS DISTINCT FROM c.brand
       OR wi.manufacturer     IS DISTINCT FROM c.manufacturer
       OR wi.supplier_id      IS DISTINCT FROM c.supplier_id
  )
  SELECT
    (SELECT count(*) FROM drifted)            AS drift_count,
    (SELECT id FROM drifted ORDER BY id LIMIT 1) AS sample_inventory_id;
$$;

REVOKE ALL ON FUNCTION public.check_catalog_mirror_parity() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.check_catalog_mirror_parity() TO authenticated;

DO $$
BEGIN
  PERFORM cron.unschedule('catalog-mirror-nightly-reconcile');
EXCEPTION WHEN OTHERS THEN
  NULL;
END;
$$;

SELECT cron.schedule(
  'catalog-mirror-nightly-reconcile',
  '15 3 * * *',
  $$ SELECT public.reconcile_catalog_mirror(); $$
);
