-- ============================================
-- Material Demand Planning: Data Quality Enhancements
-- ============================================
-- This migration:
-- 1. Cleans existing finished_goods data (trim whitespace, standardize)
-- 2. Adds triggers for automatic data normalization
-- 3. Backfills customer_po_items with style_no/size/color from linked finished goods
-- ============================================

-- STEP 1: Clean existing finished_goods data
-- Remove leading/trailing whitespace from style_no
UPDATE finished_goods
SET style_no = TRIM(style_no)
WHERE style_no IS NOT NULL 
  AND style_no != TRIM(style_no);

-- Standardize size values (uppercase)
UPDATE finished_goods
SET size = UPPER(TRIM(size))
WHERE size IS NOT NULL 
  AND (size != UPPER(TRIM(size)) OR size != TRIM(size));

-- Standardize color values (Title Case)
UPDATE finished_goods
SET color = INITCAP(TRIM(color))
WHERE color IS NOT NULL 
  AND (color != INITCAP(TRIM(color)) OR color != TRIM(color));

-- STEP 2: Create trigger function for automatic data normalization
CREATE OR REPLACE FUNCTION trim_finished_goods_attributes()
RETURNS TRIGGER AS $$
BEGIN
  -- Trim and normalize style_no
  IF NEW.style_no IS NOT NULL THEN
    NEW.style_no := TRIM(NEW.style_no);
  END IF;
  
  -- Trim and uppercase size
  IF NEW.size IS NOT NULL THEN
    NEW.size := UPPER(TRIM(NEW.size));
  END IF;
  
  -- Trim and title case color
  IF NEW.color IS NOT NULL THEN
    NEW.color := INITCAP(TRIM(NEW.color));
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger on finished_goods
DROP TRIGGER IF EXISTS trim_fg_attributes ON finished_goods;
CREATE TRIGGER trim_fg_attributes
BEFORE INSERT OR UPDATE ON finished_goods
FOR EACH ROW
EXECUTE FUNCTION trim_finished_goods_attributes();

-- STEP 3: Backfill customer_po_items with style_no, size, and color from linked finished goods
UPDATE customer_po_items cpi
SET 
  style_no = fg.style_no,
  size = fg.size,
  color = fg.color
FROM finished_goods fg
WHERE cpi.finished_good_id = fg.id
  AND (cpi.style_no IS NULL OR cpi.size IS NULL OR cpi.color IS NULL)
  AND (fg.style_no IS NOT NULL OR fg.size IS NOT NULL OR fg.color IS NOT NULL);

-- STEP 4: Create trigger function for automatic CPO item attribute population
CREATE OR REPLACE FUNCTION populate_cpo_item_attributes()
RETURNS TRIGGER AS $$
DECLARE
  fg_record RECORD;
BEGIN
  -- If finished_good_id is provided and style/size/color are missing, auto-populate
  IF NEW.finished_good_id IS NOT NULL THEN
    SELECT style_no, size, color
    INTO fg_record
    FROM finished_goods
    WHERE id = NEW.finished_good_id;
    
    IF FOUND THEN
      -- Only populate if not already set
      IF NEW.style_no IS NULL THEN
        NEW.style_no := fg_record.style_no;
      END IF;
      IF NEW.size IS NULL THEN
        NEW.size := fg_record.size;
      END IF;
      IF NEW.color IS NULL THEN
        NEW.color := fg_record.color;
      END IF;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger on customer_po_items
DROP TRIGGER IF EXISTS populate_cpo_item_attrs ON customer_po_items;
CREATE TRIGGER populate_cpo_item_attrs
BEFORE INSERT OR UPDATE ON customer_po_items
FOR EACH ROW
EXECUTE FUNCTION populate_cpo_item_attributes();