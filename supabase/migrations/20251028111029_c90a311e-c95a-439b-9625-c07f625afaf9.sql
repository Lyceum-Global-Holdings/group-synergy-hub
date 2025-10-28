-- Drop existing triggers
DROP TRIGGER IF EXISTS bom_new_linkage_validation ON bill_of_materials;
DROP TRIGGER IF EXISTS validate_bom_on_insert ON bill_of_materials;

-- Update validation function to only require product_master_id
CREATE OR REPLACE FUNCTION public.validate_new_bom_linkage()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  -- Only validate on INSERT (new BOMs)
  IF (TG_OP = 'INSERT') THEN
    -- New BOMs must have product_master_id
    IF NEW.product_master_id IS NULL THEN
      RAISE EXCEPTION 'New BOMs must have a product_master_id. Please select a Product Master.';
    END IF;
    
    -- If finished_good_id is provided, validate it's linked to the product master
    IF NEW.finished_good_id IS NOT NULL THEN
      IF NOT EXISTS (
        SELECT 1 FROM finished_goods 
        WHERE id = NEW.finished_good_id 
        AND product_master_id = NEW.product_master_id
      ) THEN
        RAISE EXCEPTION 'Finished good must be linked to the selected product master';
      END IF;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Simplify the validate_new_bom function
CREATE OR REPLACE FUNCTION public.validate_new_bom()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  -- For new BOMs (not legacy), require product_master_id
  IF NEW.is_legacy_bom = false OR NEW.is_legacy_bom IS NULL THEN
    IF NEW.product_master_id IS NULL THEN
      RAISE EXCEPTION 'New BOMs must have a product_master_id. Legacy BOMs should set is_legacy_bom = true.';
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Re-create triggers
CREATE TRIGGER bom_new_linkage_validation 
  BEFORE INSERT ON bill_of_materials 
  FOR EACH ROW 
  EXECUTE FUNCTION public.validate_new_bom_linkage();

CREATE TRIGGER validate_bom_on_insert 
  BEFORE INSERT ON bill_of_materials 
  FOR EACH ROW 
  EXECUTE FUNCTION public.validate_new_bom();