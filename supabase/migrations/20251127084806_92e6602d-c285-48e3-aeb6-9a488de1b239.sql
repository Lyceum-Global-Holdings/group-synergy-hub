-- Fix remaining functions without search_path
-- These are trigger functions that should have explicit search_path for security

-- 1. trim_finished_goods_attributes
CREATE OR REPLACE FUNCTION public.trim_finished_goods_attributes()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $function$
BEGIN
  IF NEW.attributes IS NOT NULL THEN
    NEW.attributes := (
      SELECT jsonb_object_agg(key, value)
      FROM jsonb_each(NEW.attributes)
      WHERE value IS NOT NULL AND value::text != 'null' AND value::text != '""'
    );
  END IF;
  RETURN NEW;
END;
$function$;

-- 2. update_bin_allocation_reservations
CREATE OR REPLACE FUNCTION public.update_bin_allocation_reservations()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $function$
BEGIN
  IF TG_OP = 'INSERT' OR TG_OP = 'UPDATE' THEN
    UPDATE warehouse_bin_allocations
    SET reserved_quantity = COALESCE((
      SELECT SUM(quantity_reserved)
      FROM warehouse_item_reservations
      WHERE item_id = NEW.item_id
        AND bin_location_id = NEW.bin_location_id
        AND status IN ('active', 'pending')
    ), 0)
    WHERE item_id = NEW.item_id
      AND bin_location_id = NEW.bin_location_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE warehouse_bin_allocations
    SET reserved_quantity = COALESCE((
      SELECT SUM(quantity_reserved)
      FROM warehouse_item_reservations
      WHERE item_id = OLD.item_id
        AND bin_location_id = OLD.bin_location_id
        AND status IN ('active', 'pending')
    ), 0)
    WHERE item_id = OLD.item_id
      AND bin_location_id = OLD.bin_location_id;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$function$;

-- 3. update_warehouse_item_reservations
CREATE OR REPLACE FUNCTION public.update_warehouse_item_reservations()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $function$
BEGIN
  IF TG_OP = 'INSERT' OR TG_OP = 'UPDATE' THEN
    UPDATE warehouse_items
    SET reserved_quantity = COALESCE((
      SELECT SUM(quantity_reserved)
      FROM warehouse_item_reservations
      WHERE item_id = NEW.item_id
        AND status IN ('active', 'pending')
    ), 0)
    WHERE id = NEW.item_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE warehouse_items
    SET reserved_quantity = COALESCE((
      SELECT SUM(quantity_reserved)
      FROM warehouse_item_reservations
      WHERE item_id = OLD.item_id
        AND status IN ('active', 'pending')
    ), 0)
    WHERE id = OLD.item_id;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$function$;

-- 4. validate_new_bom_linkage
CREATE OR REPLACE FUNCTION public.validate_new_bom_linkage()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $function$
DECLARE
  new_json jsonb := to_jsonb(NEW);
  fg_id_text text := NULL;
BEGIN
  fg_id_text := new_json ->> 'finished_good_id';
  RETURN NEW;
END;
$function$;