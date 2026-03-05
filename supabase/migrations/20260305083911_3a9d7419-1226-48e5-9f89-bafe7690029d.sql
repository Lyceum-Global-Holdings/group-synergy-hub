-- Fix: Update construction_labour_master records with null company_id
-- by deriving the correct company_id from their assigned location_id
UPDATE construction_labour_master clm
SET company_id = wl.company_id
FROM warehouse_locations wl
WHERE clm.location_id = wl.id
  AND clm.company_id IS NULL
  AND wl.company_id IS NOT NULL;

-- Also check warehouse_location_companies mapping as fallback
UPDATE construction_labour_master clm
SET company_id = wlc.company_id
FROM warehouse_location_companies wlc
WHERE clm.location_id = wlc.location_id
  AND clm.company_id IS NULL;

-- Create trigger to automatically set company_id from location_id on insert/update
CREATE OR REPLACE FUNCTION sync_labour_company_from_location()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only set company_id if it's null and location_id is provided
  IF NEW.company_id IS NULL AND NEW.location_id IS NOT NULL THEN
    SELECT company_id INTO NEW.company_id
    FROM warehouse_locations
    WHERE id = NEW.location_id;

    -- Fallback to warehouse_location_companies mapping
    IF NEW.company_id IS NULL THEN
      SELECT company_id INTO NEW.company_id
      FROM warehouse_location_companies
      WHERE location_id = NEW.location_id
      LIMIT 1;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_labour_company_from_location ON construction_labour_master;

CREATE TRIGGER trg_sync_labour_company_from_location
  BEFORE INSERT OR UPDATE ON construction_labour_master
  FOR EACH ROW
  EXECUTE FUNCTION sync_labour_company_from_location();