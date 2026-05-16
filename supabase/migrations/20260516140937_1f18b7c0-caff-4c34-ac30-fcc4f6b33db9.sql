
-- ============================================================
-- Stage 2: Catalog-first write contract
-- ============================================================

-- 0. Backfill any remaining drift so triggers can't fail on legacy rows.
UPDATE public.warehouse_items wi
SET
  item_code     = c.item_code,
  name          = c.name,
  description   = c.description,
  category_id   = c.category_id,
  unit_id       = c.unit_id,
  brand         = c.brand,
  manufacturer  = c.manufacturer,
  supplier_id   = c.supplier_id,
  barcode       = c.barcode,
  sku           = c.sku,
  image_url     = c.image_url,
  is_serialized = c.is_serialized,
  is_batch_tracked = c.is_batch_tracked
FROM public.warehouse_item_catalog c
WHERE wi.catalog_item_id = c.id
  AND (
       wi.item_code  IS DISTINCT FROM c.item_code
    OR wi.name       IS DISTINCT FROM c.name
    OR wi.description IS DISTINCT FROM c.description
    OR wi.category_id IS DISTINCT FROM c.category_id
    OR wi.unit_id     IS DISTINCT FROM c.unit_id
    OR wi.brand       IS DISTINCT FROM c.brand
    OR wi.manufacturer IS DISTINCT FROM c.manufacturer
    OR wi.supplier_id IS DISTINCT FROM c.supplier_id
    OR wi.barcode     IS DISTINCT FROM c.barcode
    OR wi.sku         IS DISTINCT FROM c.sku
    OR wi.image_url   IS DISTINCT FROM c.image_url
    OR wi.is_serialized IS DISTINCT FROM c.is_serialized
    OR wi.is_batch_tracked IS DISTINCT FROM c.is_batch_tracked
  );

-- 1. BEFORE INSERT/UPDATE: force mirrored columns to equal catalog
CREATE OR REPLACE FUNCTION public.wh_items_sync_from_catalog()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  c public.warehouse_item_catalog%ROWTYPE;
BEGIN
  IF NEW.catalog_item_id IS NULL THEN
    RAISE EXCEPTION 'warehouse_items.catalog_item_id is required (Stage 2 contract)';
  END IF;

  SELECT * INTO c FROM public.warehouse_item_catalog WHERE id = NEW.catalog_item_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Catalog item % not found', NEW.catalog_item_id;
  END IF;

  -- Overwrite mirrored fields with catalog values (catalog wins)
  NEW.item_code        := c.item_code;
  NEW.name             := c.name;
  NEW.description      := c.description;
  NEW.category_id      := c.category_id;
  NEW.unit_id          := c.unit_id;
  NEW.brand            := c.brand;
  NEW.manufacturer     := c.manufacturer;
  NEW.supplier_id      := c.supplier_id;
  NEW.barcode          := c.barcode;
  NEW.sku              := c.sku;
  NEW.image_url        := c.image_url;
  NEW.is_serialized    := c.is_serialized;
  NEW.is_batch_tracked := c.is_batch_tracked;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_wh_items_sync_from_catalog ON public.warehouse_items;
CREATE TRIGGER trg_wh_items_sync_from_catalog
BEFORE INSERT OR UPDATE ON public.warehouse_items
FOR EACH ROW EXECUTE FUNCTION public.wh_items_sync_from_catalog();

-- 2. AFTER UPDATE on catalog: propagate mirrored changes to all inventory rows
CREATE OR REPLACE FUNCTION public.wh_catalog_propagate()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF (NEW.item_code, NEW.name, NEW.description, NEW.category_id, NEW.unit_id,
      NEW.brand, NEW.manufacturer, NEW.supplier_id, NEW.barcode, NEW.sku,
      NEW.image_url, NEW.is_serialized, NEW.is_batch_tracked)
   IS DISTINCT FROM
     (OLD.item_code, OLD.name, OLD.description, OLD.category_id, OLD.unit_id,
      OLD.brand, OLD.manufacturer, OLD.supplier_id, OLD.barcode, OLD.sku,
      OLD.image_url, OLD.is_serialized, OLD.is_batch_tracked)
  THEN
    UPDATE public.warehouse_items
    SET
      item_code        = NEW.item_code,
      name             = NEW.name,
      description      = NEW.description,
      category_id      = NEW.category_id,
      unit_id          = NEW.unit_id,
      brand            = NEW.brand,
      manufacturer     = NEW.manufacturer,
      supplier_id      = NEW.supplier_id,
      barcode          = NEW.barcode,
      sku              = NEW.sku,
      image_url        = NEW.image_url,
      is_serialized    = NEW.is_serialized,
      is_batch_tracked = NEW.is_batch_tracked,
      updated_at       = now()
    WHERE catalog_item_id = NEW.id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_wh_catalog_propagate ON public.warehouse_item_catalog;
CREATE TRIGGER trg_wh_catalog_propagate
AFTER UPDATE ON public.warehouse_item_catalog
FOR EACH ROW EXECUTE FUNCTION public.wh_catalog_propagate();

-- 3. RPC: upsert_warehouse_inventory (per-company fields only)
CREATE OR REPLACE FUNCTION public.upsert_warehouse_inventory(
  p_company_id           uuid,
  p_catalog_item_id      uuid,
  p_location_id          uuid     DEFAULT NULL,
  p_base_uom             text     DEFAULT NULL,
  p_secondary_uom        text     DEFAULT NULL,
  p_track_secondary      boolean  DEFAULT false,
  p_reorder_level        numeric  DEFAULT NULL,
  p_min_stock_level      numeric  DEFAULT NULL,
  p_max_stock_level      numeric  DEFAULT NULL,
  p_unit_cost            numeric  DEFAULT NULL,
  p_selling_price        numeric  DEFAULT NULL,
  p_status               text     DEFAULT 'active',
  p_notes                text     DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_id   uuid;
  v_user uuid := auth.uid();
BEGIN
  IF p_company_id IS NULL OR p_catalog_item_id IS NULL THEN
    RAISE EXCEPTION 'company_id and catalog_item_id are required';
  END IF;

  -- Mirrored columns are filled by the BEFORE trigger; we pass placeholders
  -- for the NOT NULL ones (name, item_code, status) — the trigger overwrites them.
  INSERT INTO public.warehouse_items (
    company_id, catalog_item_id, location_id,
    base_uom, secondary_uom, track_secondary_quantity,
    reorder_level, min_stock_level, max_stock_level,
    unit_cost, selling_price, status, notes, created_by,
    item_code, name
  ) VALUES (
    p_company_id, p_catalog_item_id, p_location_id,
    p_base_uom, p_secondary_uom, COALESCE(p_track_secondary, false),
    p_reorder_level, p_min_stock_level, p_max_stock_level,
    p_unit_cost, p_selling_price, COALESCE(p_status, 'active'), p_notes, v_user,
    '__pending__', '__pending__'
  )
  ON CONFLICT (company_id, catalog_item_id) DO UPDATE
  SET
    location_id              = COALESCE(EXCLUDED.location_id, public.warehouse_items.location_id),
    base_uom                 = COALESCE(EXCLUDED.base_uom, public.warehouse_items.base_uom),
    secondary_uom            = COALESCE(EXCLUDED.secondary_uom, public.warehouse_items.secondary_uom),
    track_secondary_quantity = COALESCE(EXCLUDED.track_secondary_quantity, public.warehouse_items.track_secondary_quantity),
    reorder_level            = COALESCE(EXCLUDED.reorder_level, public.warehouse_items.reorder_level),
    min_stock_level          = COALESCE(EXCLUDED.min_stock_level, public.warehouse_items.min_stock_level),
    max_stock_level          = COALESCE(EXCLUDED.max_stock_level, public.warehouse_items.max_stock_level),
    unit_cost                = COALESCE(EXCLUDED.unit_cost, public.warehouse_items.unit_cost),
    selling_price            = COALESCE(EXCLUDED.selling_price, public.warehouse_items.selling_price),
    status                   = COALESCE(EXCLUDED.status, public.warehouse_items.status),
    notes                    = COALESCE(EXCLUDED.notes, public.warehouse_items.notes),
    updated_at               = now()
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.upsert_warehouse_inventory(
  uuid, uuid, uuid, text, text, boolean, numeric, numeric, numeric, numeric, numeric, text, text
) TO authenticated;

-- 4. RPC: update_warehouse_catalog_item (master attributes)
CREATE OR REPLACE FUNCTION public.update_warehouse_catalog_item(
  p_catalog_item_id  uuid,
  p_name             text    DEFAULT NULL,
  p_description      text    DEFAULT NULL,
  p_category_id      uuid    DEFAULT NULL,
  p_unit_id          uuid    DEFAULT NULL,
  p_brand            text    DEFAULT NULL,
  p_manufacturer     text    DEFAULT NULL,
  p_supplier_id      uuid    DEFAULT NULL,
  p_barcode          text    DEFAULT NULL,
  p_sku              text    DEFAULT NULL,
  p_image_url        text    DEFAULT NULL,
  p_is_serialized    boolean DEFAULT NULL,
  p_is_batch_tracked boolean DEFAULT NULL,
  p_status           text    DEFAULT NULL,
  p_notes            text    DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  UPDATE public.warehouse_item_catalog
  SET
    name             = COALESCE(p_name, name),
    description      = COALESCE(p_description, description),
    category_id      = COALESCE(p_category_id, category_id),
    unit_id          = COALESCE(p_unit_id, unit_id),
    brand            = COALESCE(p_brand, brand),
    manufacturer     = COALESCE(p_manufacturer, manufacturer),
    supplier_id      = COALESCE(p_supplier_id, supplier_id),
    barcode          = COALESCE(p_barcode, barcode),
    sku              = COALESCE(p_sku, sku),
    image_url        = COALESCE(p_image_url, image_url),
    is_serialized    = COALESCE(p_is_serialized, is_serialized),
    is_batch_tracked = COALESCE(p_is_batch_tracked, is_batch_tracked),
    status           = COALESCE(p_status, status),
    notes            = COALESCE(p_notes, notes),
    updated_at       = now()
  WHERE id = p_catalog_item_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Catalog item % not found', p_catalog_item_id;
  END IF;
  RETURN p_catalog_item_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.update_warehouse_catalog_item(
  uuid, text, text, uuid, uuid, text, text, uuid, text, text, text, boolean, boolean, text, text
) TO authenticated;

-- 5. Post-trigger sanity check
DO $$
DECLARE
  drift_count int;
BEGIN
  SELECT count(*) INTO drift_count
  FROM public.warehouse_items wi
  JOIN public.warehouse_item_catalog c ON c.id = wi.catalog_item_id
  WHERE wi.name IS DISTINCT FROM c.name
     OR wi.item_code IS DISTINCT FROM c.item_code
     OR wi.is_serialized IS DISTINCT FROM c.is_serialized
     OR wi.is_batch_tracked IS DISTINCT FROM c.is_batch_tracked;
  IF drift_count > 0 THEN
    RAISE EXCEPTION 'Stage 2 drift check failed: % rows still inconsistent', drift_count;
  END IF;
END;
$$;
