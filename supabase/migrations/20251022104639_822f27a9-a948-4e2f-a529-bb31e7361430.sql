-- Fix foreign key constraint on customer_po_items to allow flexible finished goods management
-- Drop the existing restrictive foreign key
ALTER TABLE customer_po_items
DROP CONSTRAINT IF EXISTS customer_po_items_finished_good_id_fkey;

-- Re-create with more flexible rules
ALTER TABLE customer_po_items
ADD CONSTRAINT customer_po_items_finished_good_id_fkey
FOREIGN KEY (finished_good_id)
REFERENCES finished_goods(id)
ON DELETE SET NULL  -- When finished good is deleted, set CPO item reference to NULL
ON UPDATE CASCADE;  -- When finished good ID changes, update CPO item reference

-- Add comment for documentation
COMMENT ON CONSTRAINT customer_po_items_finished_good_id_fkey 
ON customer_po_items IS 
'Foreign key to finished_goods. ON DELETE SET NULL allows finished goods to be deleted while preserving CPO items. ON UPDATE CASCADE keeps references synchronized.';

-- Update trigger function with better error handling
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
$$ LANGUAGE plpgsql;

-- Clean up orphaned references in existing data
UPDATE customer_po_items cpi
SET finished_good_id = NULL
WHERE finished_good_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM finished_goods fg WHERE fg.id = cpi.finished_good_id
  );