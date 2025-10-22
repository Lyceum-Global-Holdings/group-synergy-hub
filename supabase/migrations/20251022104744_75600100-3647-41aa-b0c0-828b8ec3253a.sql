-- Fix search_path security issue in populate_cpo_item_attributes function
CREATE OR REPLACE FUNCTION populate_cpo_item_attributes()
RETURNS TRIGGER AS $$
DECLARE
  fg_record RECORD;
BEGIN
  -- If finished_good_id is provided and style/size/color are missing, auto-populate
  IF NEW.finished_good_id IS NOT NULL THEN
    BEGIN
      SELECT style_no, size, color
      INTO STRICT fg_record
      FROM finished_goods
      WHERE id = NEW.finished_good_id;
      
      -- Only populate if not already set
      IF NEW.style_no IS NULL AND fg_record.style_no IS NOT NULL THEN
        NEW.style_no := fg_record.style_no;
      END IF;
      IF NEW.size IS NULL AND fg_record.size IS NOT NULL THEN
        NEW.size := fg_record.size;
      END IF;
      IF NEW.color IS NULL AND fg_record.color IS NOT NULL THEN
        NEW.color := fg_record.color;
      END IF;
      
    EXCEPTION
      WHEN NO_DATA_FOUND THEN
        -- Finished good not found - set to NULL to prevent constraint violation
        RAISE WARNING 'Finished good % not found, setting to NULL', NEW.finished_good_id;
        NEW.finished_good_id := NULL;
      WHEN TOO_MANY_ROWS THEN
        -- Should never happen with unique ID, but handle it
        RAISE WARNING 'Multiple finished goods found for %', NEW.finished_good_id;
    END;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;